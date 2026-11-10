let tail: Promise<void> = Promise.resolve();
let latestRevision = 0;
let pendingWrites = 0;
let workspaceReadFailure = "";
let lastWrite: Promise<void> = Promise.resolve();

export function flushWorkspaceWrites() {
  return lastWrite;
}

export function runWorkspaceWrite<T>(write: () => Promise<T>): Promise<T> {
  let value: T;
  const queued = enqueueWorkspaceWrite(async () => { value = await write(); });
  return queued.settled.then(() => value);
}

export function setWorkspaceReadFailure(reason: string) {
  workspaceReadFailure = reason;
}

export function getWorkspaceReadFailure() {
  return workspaceReadFailure;
}

export function enqueueWorkspaceWrite(write: () => Promise<void>) {
  const revision = ++latestRevision;
  pendingWrites += 1;
  const result = tail.then(write);
  lastWrite = result;
  tail = result.catch(() => undefined);

  return {
    revision,
    settled: result.finally(() => { pendingWrites -= 1; }),
  };
}

export function getWorkspaceWriteRevision() {
  return latestRevision;
}

export function hasPendingWorkspaceWrites() {
  return pendingWrites > 0;
}
