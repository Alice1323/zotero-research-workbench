(function () {
  function createResearchPanelOrchestrator(dependencies = {}) {
    const paperSummaryModule = resolvePaperSummaryModule(dependencies.paperSummaryModule);
    const graphReviewWorkflowModule = resolveGraphReviewWorkflowModule(dependencies.graphReviewWorkflowModule);
    const transactionModule = resolveTransactionModule(dependencies.transactionModule);
    const aiTaskWorkspaceModule = resolveAiTaskWorkspaceModule(dependencies.aiTaskWorkspaceModule);

    assertPaperSummaryModule(paperSummaryModule);
    assertGraphReviewWorkflowModule(graphReviewWorkflowModule);
    assertTransactionModule(transactionModule);
    assertAiTaskWorkspaceModule(aiTaskWorkspaceModule);

    function createSummaryDraftWorkflow({
      snapshot,
      paper,
      summary,
      model,
      createdAt,
      selectedWorkId,
      filters
    } = {}) {
      const timestamp = cleanText(createdAt) || new Date().toISOString();
      const draftInput = paperSummaryModule.createSummaryDraftInput({
        paper,
        summary,
        model,
        createdAt: timestamp
      });
      const result = transactionModule.createResearchNoteDraftTransaction({
        snapshot,
        draftInput,
        createdAt: timestamp
      });
      const draft = findDraft(result.snapshot, result.draftId) || draftInput;
      return {
        status: "summaryDraftCreated",
        draft,
        draftId: result.draftId,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { selectedWorkId, filters })
      };
    }

    function createReadingTranslationDraftWorkflow({
      snapshot,
      context,
      paper,
      translation,
      model,
      createdAt,
      selectedWorkId,
      filters
    } = {}) {
      const timestamp = cleanText(createdAt) || new Date().toISOString();
      const draftInput = paperSummaryModule.createReadingTranslationDraftInput({
        context,
        paper,
        translation,
        model,
        createdAt: timestamp
      });
      const result = transactionModule.createResearchNoteDraftTransaction({
        snapshot,
        draftInput,
        createdAt: timestamp
      });
      const draft = findDraft(result.snapshot, result.draftId) || draftInput;
      return {
        status: "readingTranslationDraftCreated",
        draft,
        draftId: result.draftId,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { selectedWorkId, filters })
      };
    }

    function prepareZoteroNoteWrite({ draft, savedAt } = {}) {
      const timestamp = cleanText(savedAt) || new Date().toISOString();
      return {
        status: "zoteroNoteWritePrepared",
        savedAt: timestamp,
        html: paperSummaryModule.buildZoteroNoteHtml({ draft, savedAt: timestamp })
      };
    }

    function confirmDraftSavedToZoteroWorkflow({
      snapshot,
      draftId,
      zoteroNoteKey,
      savedAt,
      selectedWorkId,
      filters
    } = {}) {
      const result = transactionModule.confirmResearchNoteDraftSavedToZoteroTransaction({
        snapshot,
        draftId,
        zoteroNoteKey,
        savedAt
      });
      return {
        status: "draftConfirmed",
        draft: findDraft(result.snapshot, draftId),
        draftId,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { selectedWorkId, filters })
      };
    }

    function captureGraphSeedWorkflow({
      snapshot,
      seedInput,
      createdAt,
      selectedWorkId,
      filters
    } = {}) {
      const result = graphReviewWorkflowModule.captureGraphSeedWorkflow({
        snapshot,
        seedInput,
        createdAt
      });
      return {
        ...result,
        records: createPanelRecords(result.snapshot, { selectedWorkId, filters })
      };
    }

    function reviewGraphSeedWorkflow({
      snapshot,
      seedId,
      reviewState,
      reviewedAt,
      reviewNote,
      selectedWorkId,
      filters
    } = {}) {
      const result = graphReviewWorkflowModule.reviewGraphSeedWorkflow({
        snapshot,
        seedId,
        reviewState,
        reviewedAt,
        reviewNote
      });
      return {
        ...result,
        records: createPanelRecords(result.snapshot, { selectedWorkId, filters })
      };
    }

    function promoteGraphSeedWorkflow({
      snapshot,
      seedId,
      promotedAt,
      selectedWorkId,
      filters
    } = {}) {
      const result = graphReviewWorkflowModule.promoteGraphSeedWorkflow({
        snapshot,
        seedId,
        promotedAt
      });
      const recordsSnapshot = result.snapshot || snapshot;
      return {
        ...result,
        records: createPanelRecords(recordsSnapshot, { selectedWorkId, filters })
      };
    }

    function createAiTaskWorkspacePlanWorkflow({
      snapshot,
      requestText,
      selectedPapers,
      taskClassification,
      provider,
      concurrencyLimit,
      createdAt
    } = {}) {
      const plan = aiTaskWorkspaceModule.createCurrentSelectionAiJobPlan({
        requestText,
        selectedPapers,
        taskClassification,
        provider,
        concurrencyLimit,
        createdAt
      });
      const result = transactionModule.createAiJobPlanTransaction({
        snapshot,
        plan,
        createdAt
      });
      return {
        status: "aiJobPlanCreated",
        plan,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, {})
      };
    }

    function confirmAiTaskWorkspacePlanWorkflow({ snapshot, jobId, confirmedAt } = {}) {
      const result = transactionModule.confirmAiJobPlanTransaction({ snapshot, jobId, confirmedAt });
      return {
        status: "aiJobConfirmed",
        jobId,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, {})
      };
    }

    function recordAiTaskWorkspaceQueueResultWorkflow({ snapshot, queueResult, recordedAt } = {}) {
      const recordQueueResult =
        transactionModule.recordAiTaskQueueResultWithDraftsTransaction ||
        transactionModule.recordAiTaskQueueResultTransaction;
      const result = recordQueueResult({ snapshot, queueResult, recordedAt });
      return {
        status: "aiTaskQueueRecorded",
        createdDraftIds: Array.isArray(result.createdDraftIds) ? result.createdDraftIds : [],
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, {})
      };
    }

    function createPanelRecords(snapshot, { selectedWorkId, filters } = {}) {
      return {
        recentDrafts: paperSummaryModule.listRecentSummaryDrafts(snapshot),
        recentGraphSeeds: paperSummaryModule.listRecentGraphSeeds(snapshot),
        recentTaskLedger: paperSummaryModule.listRecentTaskLedger(snapshot),
        graphReview: graphReviewWorkflowModule.createGraphReviewReadModel({
          snapshot,
          selectedWorkId,
          filters
        }),
        aiTaskWorkspace: aiTaskWorkspaceModule.createAiTaskWorkspaceReadModel(snapshot)
      };
    }

    return {
      captureGraphSeedWorkflow,
      confirmAiTaskWorkspacePlanWorkflow,
      confirmDraftSavedToZoteroWorkflow,
      createAiTaskWorkspacePlanWorkflow,
      createPanelRecords,
      createReadingTranslationDraftWorkflow,
      createSummaryDraftWorkflow,
      prepareZoteroNoteWrite,
      promoteGraphSeedWorkflow,
      recordAiTaskWorkspaceQueueResultWorkflow,
      reviewGraphSeedWorkflow
    };
  }

  function resolvePaperSummaryModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./paperSummary");
    }
    return null;
  }

  function resolveGraphReviewWorkflowModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./graphReviewWorkflow");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchGraphReviewWorkflow;
    }
    return null;
  }

  function resolveTransactionModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./workbenchLocalStoreTransaction");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchLocalStoreTransaction;
    }
    return null;
  }

  function resolveAiTaskWorkspaceModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./aiTaskWorkspace");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchAiTaskWorkspace;
    }
    return null;
  }

  function assertPaperSummaryModule(moduleValue) {
    assertFunction(moduleValue, "buildZoteroNoteHtml", "WorkbenchPaperSummary core Module");
    assertFunction(moduleValue, "createReadingTranslationDraftInput", "WorkbenchPaperSummary core Module");
    assertFunction(moduleValue, "createSummaryDraftInput", "WorkbenchPaperSummary core Module");
    assertFunction(moduleValue, "listRecentGraphSeeds", "WorkbenchPaperSummary core Module");
    assertFunction(moduleValue, "listRecentSummaryDrafts", "WorkbenchPaperSummary core Module");
    assertFunction(moduleValue, "listRecentTaskLedger", "WorkbenchPaperSummary core Module");
  }

  function assertGraphReviewWorkflowModule(moduleValue) {
    assertFunction(moduleValue, "captureGraphSeedWorkflow", "WorkbenchGraphReviewWorkflow Module");
    assertFunction(moduleValue, "createGraphReviewReadModel", "WorkbenchGraphReviewWorkflow Module");
    assertFunction(moduleValue, "promoteGraphSeedWorkflow", "WorkbenchGraphReviewWorkflow Module");
    assertFunction(moduleValue, "reviewGraphSeedWorkflow", "WorkbenchGraphReviewWorkflow Module");
  }

  function assertTransactionModule(moduleValue) {
    assertFunction(moduleValue, "confirmAiJobPlanTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "confirmResearchNoteDraftSavedToZoteroTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "createAiJobPlanTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "createResearchNoteDraftTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "recordAiTaskQueueResultTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "recordAiTaskQueueResultWithDraftsTransaction", "WorkbenchLocalStoreTransaction Module");
  }

  function assertAiTaskWorkspaceModule(moduleValue) {
    assertFunction(moduleValue, "createAiTaskWorkspaceReadModel", "WorkbenchAiTaskWorkspace Module");
    assertFunction(moduleValue, "createCurrentSelectionAiJobPlan", "WorkbenchAiTaskWorkspace Module");
  }

  function assertFunction(moduleValue, functionName, moduleName) {
    if (!moduleValue || typeof moduleValue[functionName] !== "function") {
      throw new Error(`${moduleName} is missing ${functionName}`);
    }
  }

  function findDraft(snapshot, draftId) {
    const normalizedDraftId = cleanText(draftId);
    return (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : []).find(
      (draft) => cleanText(draft?.id) === normalizedDraftId
    );
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  const WorkbenchResearchPanelOrchestrator = {
    createResearchPanelOrchestrator
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = WorkbenchResearchPanelOrchestrator;
  }

  if (typeof window !== "undefined") {
    window.WorkbenchResearchPanelOrchestrator = WorkbenchResearchPanelOrchestrator;
  }
})();
