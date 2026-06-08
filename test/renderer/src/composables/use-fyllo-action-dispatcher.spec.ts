import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFylloActionDispatcher } from "@renderer/composables/useFylloActionDispatcher";

const createTaskMock = vi.hoisted(() => vi.fn());

vi.mock("@renderer/stores/task", () => ({
  useTaskStore: () => ({
    createTask: createTaskMock,
  }),
}));

describe("useFylloActionDispatcher", () => {
  beforeEach(() => {
    createTaskMock.mockReset();
  });

  it("converts task.create payloads into local task input", async () => {
    createTaskMock.mockResolvedValue({});

    const { dispatchFylloAction } = useFylloActionDispatcher();
    const result = await dispatchFylloAction("task.create", {
      title: "补齐错误处理",
      description: "整理异常分支",
    });

    expect(result).toEqual({ ok: true });
    expect(createTaskMock).toHaveBeenCalledWith({
      title: "补齐错误处理",
      description: {
        format: "plain_text",
        content: "整理异常分支",
      },
    });
  });

  it("uses empty plain text when description is missing", async () => {
    createTaskMock.mockResolvedValue({});

    const { dispatchFylloAction } = useFylloActionDispatcher();
    await dispatchFylloAction("task.create", {
      title: "补齐错误处理",
    });

    expect(createTaskMock).toHaveBeenCalledWith({
      title: "补齐错误处理",
      description: {
        format: "plain_text",
        content: "",
      },
    });
  });

  it("returns failed results when task creation throws", async () => {
    createTaskMock.mockRejectedValue(new Error("当前没有选中的项目"));

    const { dispatchFylloAction } = useFylloActionDispatcher();
    const result = await dispatchFylloAction("task.create", {
      title: "补齐错误处理",
    });

    expect(result).toEqual({
      ok: false,
      error: "当前没有选中的项目",
    });
  });
});
