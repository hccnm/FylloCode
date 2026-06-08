export type FylloActionType = "task.create";

export interface TaskCreateActionPayload {
  title: string;
  description?: string;
}

export interface FylloActionPayloadByType {
  "task.create": TaskCreateActionPayload;
}

export type FylloActionPayload<T extends FylloActionType = FylloActionType> =
  FylloActionPayloadByType[T];

export type FylloActionParseErrorCode =
  | "missing_type"
  | "invalid_type_name"
  | "unknown_type"
  | "unexpected_attribute"
  | "invalid_json"
  | "invalid_payload";

export interface FylloActionParseError {
  code: FylloActionParseErrorCode;
  message: string;
  details?: string[];
}

export interface FylloActionPendingParseResult {
  status: "pending";
  type?: string;
}

export interface FylloActionInvalidParseResult {
  status: "invalid";
  type?: string;
  error: FylloActionParseError;
}

export type FylloActionReadyParseResult = {
  [Type in FylloActionType]: {
    status: "ready";
    type: Type;
    payload: FylloActionPayloadByType[Type];
  };
}[FylloActionType];

export type FylloActionParseResult =
  | FylloActionPendingParseResult
  | FylloActionInvalidParseResult
  | FylloActionReadyParseResult;

export type FylloActionHandlerResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type FylloActionStateStatus = "succeeded" | "failed" | "cancelled";

export interface FylloActionState {
  type: FylloActionType;
  status: FylloActionStateStatus;
  updatedAt: string;
}
