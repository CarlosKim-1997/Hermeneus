export class CreatorUnauthenticatedError extends Error {
  constructor(message = "Creator session is required.") {
    super(message);
    this.name = "CreatorUnauthenticatedError";
  }
}

export class HandoffAccessUnavailableError extends Error {
  constructor(message = "Handoff is unavailable.") {
    super(message);
    this.name = "HandoffAccessUnavailableError";
  }
}

export class CreatorLifecycleBlockedError extends Error {
  constructor(message = "This Creator account is unavailable for workspace access.") {
    super(message);
    this.name = "CreatorLifecycleBlockedError";
  }
}
