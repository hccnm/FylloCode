import { useTaskStore } from "@renderer/stores/task";
import type {
  FylloActionHandlerResult,
  FylloActionPayloadByType,
  FylloActionType,
} from "@shared/types/fyllo-action";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useFylloActionDispatcher(): {
  dispatchFylloAction: <Type extends FylloActionType>(
    type: Type,
    payload: FylloActionPayloadByType[Type]
  ) => Promise<FylloActionHandlerResult>;
} {
  const taskStore = useTaskStore();

  async function dispatchFylloAction<Type extends FylloActionType>(
    type: Type,
    payload: FylloActionPayloadByType[Type]
  ): Promise<FylloActionHandlerResult> {
    try {
      if (type === "task.create") {
        const taskPayload = payload as FylloActionPayloadByType["task.create"];
        await taskStore.createTask({
          title: taskPayload.title,
          description: {
            format: "plain_text",
            content: taskPayload.description ?? "",
          },
        });

        return { ok: true };
      }

      return {
        ok: false,
        error: "Unsupported Fyllo action type.",
      };
    } catch (error) {
      return {
        ok: false,
        error: getErrorMessage(error),
      };
    }
  }

  return {
    dispatchFylloAction,
  };
}
