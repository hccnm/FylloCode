import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ChatMessageList from "@renderer/components/chat/message/ChatMessageList.vue";
import { chatApi } from "@renderer/api/chat";
import type { ChatStatus, MessageMeta } from "@shared/types/chat";
import type { UIMessage } from "ai";

vi.mock("@renderer/api/chat", () => ({
  chatApi: {
    readAttachmentDataUrl: vi.fn(),
  },
}));

function textMessage(): UIMessage<MessageMeta> {
  return {
    id: "message-1",
    role: "assistant",
    parts: [{ type: "text", text: "hello" }],
    metadata: { sessionId: "session-1", createdAt: new Date("2026-05-08T00:00:00.000Z") },
  };
}

function userMessage(parts: UIMessage<MessageMeta>["parts"]): UIMessage<MessageMeta> {
  return {
    id: "user-message-1",
    role: "user",
    parts,
    metadata: { sessionId: "session-1", createdAt: new Date("2026-05-08T00:00:00.000Z") },
  };
}

function toolMessage(): UIMessage<MessageMeta> {
  return {
    id: "message-2",
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolCallId: "tool-1",
        toolName: "Read",
        state: "output-available",
        input: {},
        output: "done",
      },
    ],
    metadata: { sessionId: "session-1", createdAt: new Date("2026-05-08T00:00:00.000Z") },
  };
}

type TextPartMetrics = {
  scrollHeight: number;
  clientHeight: number;
};

let restoreTextHeightMock: (() => void) | null = null;

function mockUserTextPartHeights(getMetrics: (element: HTMLElement) => TextPartMetrics): void {
  const prototype = HTMLElement.prototype;
  const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollHeight");
  const clientHeightDescriptor = Object.getOwnPropertyDescriptor(prototype, "clientHeight");

  restoreTextHeightMock?.();

  Object.defineProperty(prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return getMetrics(this).scrollHeight;
    },
  });

  Object.defineProperty(prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return getMetrics(this).clientHeight;
    },
  });

  restoreTextHeightMock = () => {
    if (scrollHeightDescriptor) {
      Object.defineProperty(prototype, "scrollHeight", scrollHeightDescriptor);
    } else {
      Reflect.deleteProperty(prototype, "scrollHeight");
    }

    if (clientHeightDescriptor) {
      Object.defineProperty(prototype, "clientHeight", clientHeightDescriptor);
    } else {
      Reflect.deleteProperty(prototype, "clientHeight");
    }
  };
}

function mockUserTextOverflow(isOverflowing: (text: string) => boolean): void {
  mockUserTextPartHeights((element) => {
    if (element.getAttribute("data-test") !== "user-message-text") {
      return { scrollHeight: 0, clientHeight: 0 };
    }

    return isOverflowing(element.textContent ?? "")
      ? { scrollHeight: 240, clientHeight: 160 }
      : { scrollHeight: 120, clientHeight: 160 };
  });
}

function mountList(
  messages: UIMessage<MessageMeta>[],
  status: ChatStatus = "ready",
  agentId?: string
): VueWrapper {
  const chatMessagesStub = {
    props: ["messages", "status"],
    template:
      '<div data-test="chat-messages" :data-status="status"><div v-for="message in messages" :key="message.id"><slot name="content" :message="message" /></div></div>',
  };
  const chatToolStub = {
    template: '<div data-test="tool"><slot /></div>',
  };
  const chatReasoningStub = {
    template: "<div><slot /></div>",
  };

  return mount(ChatMessageList, {
    props: {
      messages,
      status,
      type: "chat",
      agentId,
    },
    global: {
      plugins: [createPinia()],
      stubs: {
        MarkStream: {
          props: ["content", "isStreaming", "isDark"],
          template: '<div data-test="markdown">{{ content }}</div>',
        },
        UChatMessages: chatMessagesStub,
        ChatMessages: chatMessagesStub,
        UChatTool: chatToolStub,
        ChatTool: chatToolStub,
        UChatReasoning: chatReasoningStub,
        ChatReasoning: chatReasoningStub,
      },
    },
  });
}

describe("UIMessageList", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(chatApi.readAttachmentDataUrl).mockResolvedValue({
      ok: true,
      data: { dataUrl: "data:image/png;base64,AAAA" },
    });
  });

  afterEach(() => {
    restoreTextHeightMock?.();
    restoreTextHeightMock = null;
  });

  it("renders text parts", () => {
    const wrapper = mountList([textMessage()]);

    expect(wrapper.text()).toContain("hello");
  });

  it("renders dynamic tool parts", () => {
    const wrapper = mountList([toolMessage()]);

    expect(wrapper.text()).toContain("done");
  });

  it("renders empty lists and passes status through", () => {
    const wrapper = mountList([], "streaming");

    expect(wrapper.find('[data-test="chat-messages"]').attributes("data-status")).toBe("streaming");
    expect(wrapper.text()).toBe("");
  });

  it("hides reminder parts in user messages but keeps normal text", () => {
    const wrapper = mountList([
      userMessage([
        { type: "text", text: "<system-reminder>\nbody\n</system-reminder>" },
        { type: "text", text: "visible user text" },
      ]),
    ]);

    expect(wrapper.text()).toContain("visible user text");
    expect(wrapper.text()).not.toContain("system-reminder");
  });

  it("collapses overflowing user text parts by default", async () => {
    mockUserTextOverflow((text) => text.includes("long user text"));

    const wrapper = mountList([
      userMessage([{ type: "text", text: "long user text\n".repeat(20) }]),
    ]);

    await vi.waitFor(() => {
      expect(wrapper.get('[data-test="user-message-text-toggle"]').text()).toContain("展开");
    });

    const text = wrapper.get('[data-test="user-message-text"]');
    expect(text.classes()).toContain("max-h-40");
    expect(text.classes()).toContain("overflow-hidden");
    expect(wrapper.get('[data-test="user-message-text-toggle"]').attributes("aria-expanded")).toBe(
      "false"
    );
  });

  it("toggles overflowing user text parts between expanded and collapsed states", async () => {
    mockUserTextOverflow((text) => text.includes("long user text"));

    const wrapper = mountList([
      userMessage([{ type: "text", text: "long user text\n".repeat(20) }]),
    ]);

    await vi.waitFor(() => {
      expect(wrapper.get('[data-test="user-message-text-toggle"]').text()).toContain("展开");
    });

    await wrapper.get('[data-test="user-message-text-toggle"]').trigger("click");

    expect(wrapper.get('[data-test="user-message-text-toggle"]').text()).toContain("收起");
    expect(wrapper.get('[data-test="user-message-text-toggle"]').attributes("aria-expanded")).toBe(
      "true"
    );
    expect(wrapper.get('[data-test="user-message-text"]').classes()).not.toContain("max-h-40");
    expect(wrapper.get('[data-test="user-message-text"]').classes()).not.toContain(
      "overflow-hidden"
    );

    await wrapper.get('[data-test="user-message-text-toggle"]').trigger("click");

    expect(wrapper.get('[data-test="user-message-text-toggle"]').text()).toContain("展开");
    expect(wrapper.get('[data-test="user-message-text-toggle"]').attributes("aria-expanded")).toBe(
      "false"
    );
    expect(wrapper.get('[data-test="user-message-text"]').classes()).toContain("max-h-40");
    expect(wrapper.get('[data-test="user-message-text"]').classes()).toContain("overflow-hidden");
  });

  it("does not render text toggles for user text parts within the collapsed height", async () => {
    mockUserTextOverflow(() => false);

    const wrapper = mountList([userMessage([{ type: "text", text: "short user text" }])]);

    await vi.waitFor(() => {
      expect(wrapper.get('[data-test="user-message-text"]').classes()).not.toContain("max-h-40");
    });

    expect(wrapper.find('[data-test="user-message-text-toggle"]').exists()).toBe(false);
  });

  it("keeps multiple overflowing user text parts independently collapsible", async () => {
    mockUserTextOverflow((text) => text.includes("first long") || text.includes("second long"));

    const wrapper = mountList([
      userMessage([
        { type: "text", text: "first long user text\n".repeat(20) },
        { type: "text", text: "second long user text\n".repeat(20) },
      ]),
    ]);

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-test="user-message-text-toggle"]')).toHaveLength(2);
    });

    const textParts = wrapper.findAll('[data-test="user-message-text"]');
    const toggles = wrapper.findAll('[data-test="user-message-text-toggle"]');

    await toggles[0].trigger("click");

    expect(toggles[0].text()).toContain("收起");
    expect(toggles[1].text()).toContain("展开");
    expect(textParts[0].classes()).not.toContain("max-h-40");
    expect(textParts[1].classes()).toContain("max-h-40");
  });

  it("does not crash when a user message only contains a reminder", () => {
    const wrapper = mountList([
      userMessage([{ type: "text", text: "<system-reminder>\nbody\n</system-reminder>" }]),
    ]);

    expect(wrapper.text()).toBe("");
  });

  it("does not filter assistant text that only looks like a reminder", () => {
    const wrapper = mountList([
      {
        id: "assistant-reminder-like",
        role: "assistant",
        parts: [{ type: "text", text: "<system-reminder>\nassistant output\n</system-reminder>" }],
        metadata: { sessionId: "session-1", createdAt: new Date("2026-05-08T00:00:00.000Z") },
      },
    ]);

    expect(wrapper.text()).toContain("assistant output");
  });

  it("resolves file:// image parts through chatApi.readAttachmentDataUrl", async () => {
    const wrapper = mountList([
      userMessage([
        {
          type: "file",
          mediaType: "image/png",
          url: "file:///tmp/%E6%88%AA%E5%9B%BE%201.png",
          filename: "截图 1.png",
        },
      ]),
    ]);

    await vi.waitFor(() => {
      expect(vi.mocked(chatApi.readAttachmentDataUrl)).toHaveBeenCalledWith(
        "file:///tmp/%E6%88%AA%E5%9B%BE%201.png",
        "image/png"
      );
    });
    await vi.waitFor(() => {
      expect(wrapper.get('[data-test="user-message-image-card"] img').attributes("src")).toBe(
        "data:image/png;base64,AAAA"
      );
    });
  });

  it("uses non-file image URLs directly without IPC", () => {
    const wrapper = mountList([
      userMessage([
        {
          type: "file",
          mediaType: "image/png",
          url: "data:image/png;base64,BBBB",
          filename: "inline.png",
        },
      ]),
    ]);

    expect(vi.mocked(chatApi.readAttachmentDataUrl)).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="user-message-image-card"] img').attributes("src")).toBe(
      "data:image/png;base64,BBBB"
    );
  });

  it("renders non-image file parts as file cards", () => {
    const wrapper = mountList([
      userMessage([
        {
          type: "file",
          mediaType: "application/pdf",
          url: "file:///tmp/doc.pdf",
          filename: "doc.pdf",
        },
      ]),
    ]);

    const card = wrapper.get('[data-test="user-message-file-card"]');
    expect(card.text()).toContain("doc.pdf");
    expect(card.text()).toContain("PDF");
  });
});
