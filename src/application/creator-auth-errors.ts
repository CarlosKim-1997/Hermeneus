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
