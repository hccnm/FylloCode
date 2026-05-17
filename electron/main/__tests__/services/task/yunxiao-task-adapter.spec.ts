import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectIntegrationConfig } from "@shared/types/integration";
import type { Workitem } from "@main/domain/integration/yunxiao/projex";

const mocks = vi.hoisted(() => ({
  loadProjectIntegrationConfig: vi.fn(),
  getYunxiaoOrganizationId: vi.fn(() => "org-1"),
  getYunxiaoUserId: vi.fn(() => "user-1"),
  searchWorkitems: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@main/infra/storage/project-integration-store", () => ({
  loadProjectIntegrationConfig: mocks.loadProjectIntegrationConfig,
}));

vi.mock("@main/infra/storage/yunxiao-credentials", () => ({
  getYunxiaoOrganizationId: mocks.getYunxiaoOrganizationId,
  getYunxiaoUserId: mocks.getYunxiaoUserId,
}));

vi.mock("@main/domain/integration/yunxiao/projex", () => ({
  searchWorkitems: mocks.searchWorkitems,
}));

vi.mock("@main/infra/logger", () => ({
  default: {
    info: mocks.info,
    warn: mocks.warn,
  },
}));

import {
  buildSearchWorkitemsParams,
  yunxiaoTaskAdapter,
} from "@main/services/task/adapters/yunxiao-task-adapter";

function createEmptyIntegrationConfig(): ProjectIntegrationConfig {
  return {
    "project-management": [],
    "source-control": [],
    "ci-cd": [],
    deployment: [],
    communication: [],
    observability: [],
  };
}

function buildWorkitem(
  id: string,
  overrides: Partial<Workitem> = {},
  statusDisplayName = "处理中"
): Workitem {
  return {
    id,
    subject: `Task ${id}`,
    description: `Description ${id}`,
    serialNumber: `YX-${id}`,
    gmtCreate: "2026-05-10T08:00:00.000Z",
    gmtModified: "2026-05-10T09:00:00.000Z",
    updateStatusAt: "2026-05-10T10:00:00.000Z",
    assignedTo: {
      id: "assignee-1",
      name: "张三",
    },
    space: {
      id: "space-1",
      name: "空间 A",
    },
    status: {
      id: `status-${id}`,
      name: "In Progress",
      nameEn: "In Progress",
      displayName: statusDisplayName,
    },
    ...overrides,
  };
}

describe("yunxiao-task-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getYunxiaoOrganizationId.mockReturnValue("org-1");
    mocks.getYunxiaoUserId.mockReturnValue("user-1");
  });

  it("returns an empty list when the project has no mounted yunxiao space", async () => {
    mocks.loadProjectIntegrationConfig.mockReturnValue(createEmptyIntegrationConfig());

    await expect(yunxiaoTaskAdapter.list("project-1")).resolves.toEqual([]);
    expect(mocks.searchWorkitems).not.toHaveBeenCalled();
  });

  it("queries req task bug and maps them into task items", async () => {
    mocks.loadProjectIntegrationConfig.mockReturnValue({
      ...createEmptyIntegrationConfig(),
      "project-management": [
        {
          providerId: "yunxiao",
          resourceType: "projex-project",
          resourceId: "space-1",
        },
      ],
    });

    mocks.searchWorkitems.mockImplementation(async (params) => {
      if (params.category === "Req") {
        return [
          buildWorkitem("101", {
            serialNumber: "YX-101",
            gmtModified: "2026-05-10T12:00:00.000Z",
            space: { id: "space-1", name: "项目一" },
            status: {
              id: "req-status",
              name: "Processing",
              nameEn: "Processing",
              displayName: "开发中",
            },
          }),
        ];
      }

      if (params.category === "Task") {
        return [
          buildWorkitem("102", {
            serialNumber: "YX-102",
            gmtModified: "2026-05-10T11:00:00.000Z",
            description: "",
            space: { id: "space-1", name: "项目一" },
            status: {
              id: "task-status",
              name: "Todo",
              nameEn: "Todo",
              displayName: "待处理",
            },
          }),
        ];
      }

      return [
        buildWorkitem("103", {
          serialNumber: "YX-103",
          gmtModified: undefined,
          updateStatusAt: "2026-05-10T10:30:00.000Z",
          assignedTo: null,
          space: { id: "space-1", name: "项目一" },
          status: {
            id: "bug-status",
            name: "Open",
            nameEn: "Open",
            displayName: "已打开",
          },
        }),
      ];
    });

    const result = await yunxiaoTaskAdapter.list("project-1");

    expect(mocks.searchWorkitems).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result.map((task) => task.id)).toEqual([
      "yunxiao:space-1:101",
      "yunxiao:space-1:102",
      "yunxiao:space-1:103",
    ]);
    expect(result[0]).toMatchObject({
      projectId: "project-1",
      source: "yunxiao",
      status: "open",
      title: "Task 101",
      description: "Description 101",
      sourceMeta: {
        source: "yunxiao",
        key: "YX-101",
        issueType: "需求",
      },
      assignee: {
        id: "assignee-1",
        name: "张三",
      },
    });
    expect(result[0]?.labels.map((label) => label.name)).toEqual(["项目一", "需求", "开发中"]);
    expect(result[0]?.sourceMeta).not.toHaveProperty("url");
    expect(result[2]?.labels.map((label) => label.name)).toEqual(["项目一", "缺陷", "已打开"]);
    expect(result[2]?.assignee).toBeUndefined();
    expect(result[2]?.updatedAt.toISOString()).toBe("2026-05-10T10:30:00.000Z");
  });

  it("keeps successful results when some spaces or categories fail", async () => {
    mocks.loadProjectIntegrationConfig.mockReturnValue({
      ...createEmptyIntegrationConfig(),
      "project-management": [
        {
          providerId: "yunxiao",
          resourceType: "projex-project",
          resourceId: "space-1",
        },
        {
          providerId: "yunxiao",
          resourceType: "projex-project",
          resourceId: "space-2",
        },
      ],
    });

    mocks.searchWorkitems.mockImplementation(async (params) => {
      if (params.spaceId === "space-2" && params.category === "Bug") {
        throw new Error("boom");
      }

      return [
        buildWorkitem(`${params.spaceId}-${params.category}`, {
          serialNumber: `${params.spaceId}-${params.category}`,
          space: {
            id: params.spaceId,
            name: params.spaceId === "space-1" ? "项目一" : "项目二",
          },
        }),
      ];
    });

    const result = await yunxiaoTaskAdapter.list("project-2");

    expect(result).toHaveLength(5);
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledWith(
      "[task][yunxiao] failed to load workitems",
      expect.objectContaining({
        projectId: "project-2",
        spaceId: "space-2",
        category: "Bug",
      })
    );
  });

  it("builds fixed query params using stored user id", () => {
    const params = buildSearchWorkitemsParams("space-1", "Req", "org-9", "user-88");

    expect(params).toMatchObject({
      organizationId: "org-9",
      spaceId: "space-1",
      category: "Req",
      spaceType: "Project",
      orderBy: "gmtCreate",
      sort: "desc",
      page: 1,
      perPage: 20,
    });

    const conditions = JSON.parse(params.conditions ?? "{}") as {
      conditionGroups: Array<
        Array<{
          fieldIdentifier: string;
          operator: string;
          value: string[];
        }>
      >;
    };

    expect(conditions.conditionGroups[0]).toEqual([
      expect.objectContaining({
        fieldIdentifier: "status",
        operator: "CONTAINS",
        value: [
          "100005",
          "625489",
          "154395",
          "165115",
          "100010",
          "156603",
          "307012",
          "100011",
          "142838",
          "100012",
          "100013",
          "92f8892614756eb5551309e826",
          "bc9040b0df1bbe9dc7a335b75a",
        ],
      }),
      expect.objectContaining({
        fieldIdentifier: "assignedTo",
        operator: "CONTAINS",
        value: ["user-88"],
      }),
    ]);
  });
});
