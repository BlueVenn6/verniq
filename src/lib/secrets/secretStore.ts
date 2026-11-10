import { isTauriDesktop } from "@/src/lib/workspace/desktopStorage";

export type SecretStoreKind = "desktop_os" | "web_session" | "unsupported";

export type SecretStoreStatus = {
  kind: SecretStoreKind;
  available: boolean;
  warning?: string;
};

export type SecretStore = {
  kind: SecretStoreKind;
  isAvailable(): Promise<boolean>;
  saveSecret(ref: string, secret: string): Promise<void>;
  readSecret(ref: string): Promise<string | null>;
  deleteSecret(ref: string): Promise<void>;
  getStatus(): Promise<SecretStoreStatus>;
};

const webSessionSecrets = new Map<string, string>();
const webSecretKey = (ref: string) => `verniq:web-session-secret:${ref}`;

export function createCredentialRef(providerId: string) {
  return `verniq:ai-provider:${providerId}:api-key`;
}

export function createSecretStore(): SecretStore {
  return isTauriDesktop() ? createDesktopOsSecretStore() : createWebSessionSecretStore();
}

export async function getSecretStoreStatus() {
  return createSecretStore().getStatus();
}

export async function saveCredentialSecret(ref: string, secret: string) {
  return createSecretStore().saveSecret(ref, secret);
}

export async function readCredentialSecret(ref: string) {
  return createSecretStore().readSecret(ref);
}

export async function deleteCredentialSecret(ref: string) {
  return createSecretStore().deleteSecret(ref);
}

function createWebSessionSecretStore(): SecretStore {
  return {
    kind: "web_session",
    async isAvailable() {
      return true;
    },
    async saveSecret(ref, secret) {
      // Session storage survives reloads and full-page route navigation, while
      // keeping credentials out of exported workspace files and localStorage.
      // A failed write must be reported, rather than claiming the key was saved.
      try {
        window.sessionStorage.setItem(webSecretKey(ref), secret);
      } catch {
        throw new Error("浏览器无法保存会话密钥，请允许会话存储后重试。");
      }
      webSessionSecrets.set(ref, secret);
    },
    async readSecret(ref) {
      const current = webSessionSecrets.get(ref);
      if (current) return current;
      try {
        const saved = window.sessionStorage.getItem(webSecretKey(ref));
        if (saved) webSessionSecrets.set(ref, saved);
        return saved;
      } catch {
        return null;
      }
    },
    async deleteSecret(ref) {
      window.sessionStorage.removeItem(webSecretKey(ref));
      webSessionSecrets.delete(ref);
    },
    async getStatus() {
      return {
        kind: "web_session",
        available: true,
        warning:
          "网页模式不提供系统级密钥存储。API 密钥只会保存在当前浏览器会话中。",
      };
    },
  };
}

function createDesktopOsSecretStore(): SecretStore {
  return {
    kind: "desktop_os",
    async isAvailable() {
      const status = await this.getStatus();

      return status.available;
    },
    async saveSecret(ref, secret) {
      await invokeSecretCommand<void>("secret_save", {
        credentialRef: ref,
        secret,
      });
    },
    async readSecret(ref) {
      return invokeSecretCommand<string | null>("secret_read", {
        credentialRef: ref,
      });
    },
    async deleteSecret(ref) {
      await invokeSecretCommand<void>("secret_delete", {
        credentialRef: ref,
      });
    },
    async getStatus() {
      try {
        return parseDesktopSecretStoreStatus(
          await invokeSecretCommand<string>("secret_store_status"),
        );
      } catch (error) {
        return {
          kind: "unsupported",
          available: false,
          warning: formatSecretStoreError(error),
        };
      }
    },
  };
}

async function invokeSecretCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");

  return invoke<T>(command, args);
}

function formatSecretStoreError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "OS secret storage is not available.";

  return `OS secret storage is not available. ${message}`;
}

function parseDesktopSecretStoreStatus(value: string): SecretStoreStatus {
  try {
    const parsed = JSON.parse(value) as Partial<SecretStoreStatus>;

    if (parsed.kind === "desktop_os" && parsed.available) {
      return {
        kind: "desktop_os",
        available: true,
        warning: parsed.warning,
      };
    }

    return {
      kind: "unsupported",
      available: false,
      warning:
        parsed.warning ??
        "系统凭据存储当前不可用。如果继续，API 密钥可能会保存在旧的明文配置中。",
    };
  } catch {
    return {
      kind: "unsupported",
      available: false,
      warning:
        "系统凭据存储返回异常状态。如果继续，API 密钥可能会保存在旧的明文配置中。",
    };
  }
}
