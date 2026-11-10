import { describe, expect, it } from "vitest";
import { enqueueWorkspaceWrite, flushWorkspaceWrites, runWorkspaceWrite, getWorkspaceWriteRevision, hasPendingWorkspaceWrites } from "@/src/lib/workspace/writeQueue";

describe("workspace write queue", () => {
  it("keeps a delayed older save from overwriting a newer save", async () => {
    let file = "";
    let releaseFirst!: () => void;
    const waitForFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = enqueueWorkspaceWrite(async () => { await waitForFirst; file = "older"; });
    const second = enqueueWorkspaceWrite(async () => { file = "newer"; });

    expect(hasPendingWorkspaceWrites()).toBe(true);
    expect(getWorkspaceWriteRevision()).toBe(second.revision);
    releaseFirst();
    await Promise.all([first.settled, second.settled]);
    expect(file).toBe("newer");
    expect(hasPendingWorkspaceWrites()).toBe(false);
  });

  it("continues writing after a failed request", async () => {
    const first = enqueueWorkspaceWrite(async () => { throw new Error("disk full"); });
    let saved = false;
    const second = enqueueWorkspaceWrite(async () => { saved = true; });

    await expect(first.settled).rejects.toThrow("disk full");
    await second.settled;
    expect(saved).toBe(true);
  });
});

it("does not report a failed save as a successful flush", async () => {
  const failed = enqueueWorkspaceWrite(async () => { throw new Error("disk failure"); });
  await expect(failed.settled).rejects.toThrow("disk failure");
  await expect(flushWorkspaceWrites()).rejects.toThrow("disk failure");
  expect(await runWorkspaceWrite(async () => "saved copy")).toBe("saved copy");
  await expect(flushWorkspaceWrites()).resolves.toBeUndefined();
});
