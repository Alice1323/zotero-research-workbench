(function () {
  function createResearchPanelOrchestrator(dependencies = {}) {
    const paperSummaryModule = resolvePaperSummaryModule(dependencies.paperSummaryModule);
    const graphReviewWorkflowModule = resolveGraphReviewWorkflowModule(dependencies.graphReviewWorkflowModule);
    const transactionModule = resolveTransactionModule(dependencies.transactionModule);
    const aiTaskWorkspaceModule = resolveAiTaskWorkspaceModule(dependencies.aiTaskWorkspaceModule);
    const literatureDiscoveryModule = resolveLiteratureDiscoveryModule(dependencies.literatureDiscoveryModule);
    const candidateReviewModule = resolveCandidateReviewModule(
      dependencies.documentCandidateReviewModule || dependencies.candidateReviewModule
    );
    const zoteroWriteQueueModule = resolveZoteroWriteQueueModule(dependencies.zoteroWriteQueueModule);
    const etherealReferenceGraphModule = resolveEtherealReferenceGraphModule(dependencies.etherealReferenceGraphModule);

    assertPaperSummaryModule(paperSummaryModule);
    assertGraphReviewWorkflowModule(graphReviewWorkflowModule);
    assertTransactionModule(transactionModule);
    assertAiTaskWorkspaceModule(aiTaskWorkspaceModule);
    assertLiteratureDiscoveryModule(literatureDiscoveryModule);
    assertCandidateReviewModule(candidateReviewModule);
    assertZoteroWriteQueueModule(zoteroWriteQueueModule);
    assertEtherealReferenceGraphModule(etherealReferenceGraphModule);

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

    function createLiteratureDiscoveryPlanWorkflow({
      snapshot,
      topicId,
      requestText,
      launchSurface,
      sourceScopes,
      sources,
      maxCandidates,
      createdAt
    } = {}) {
      const plan = literatureDiscoveryModule.createLiteratureDiscoveryJobPlan({
        topicId,
        requestText,
        launchSurface,
        sourceScopes,
        sources,
        maxCandidates,
        createdAt
      });
      const result = transactionModule.createLiteratureDiscoveryPlanTransaction({ snapshot, plan, createdAt });
      return {
        status: "literatureDiscoveryPlanCreated",
        plan,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { topicId })
      };
    }

    function markDocumentCandidateReviewedWorkflow({
      snapshot,
      topicId,
      candidateId,
      reviewDecision,
      reviewNote,
      reviewedAt
    } = {}) {
      const result = transactionModule.markDocumentCandidateReviewedTransaction({
        snapshot,
        candidateId,
        reviewDecision,
        reviewNote,
        reviewedAt
      });
      return {
        status: "documentCandidateReviewed",
        candidateId,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { topicId })
      };
    }

    function createZoteroImportPlanWorkflow({
      snapshot,
      topicId,
      selections,
      targetCollectionKey,
      createdAt
    } = {}) {
      const importPlan = candidateReviewModule.createZoteroImportPlanFromCandidates({
        topicId,
        candidates: Array.isArray(snapshot?.documentCandidates) ? snapshot.documentCandidates : [],
        selections,
        targetCollectionKey,
        createdAt
      });
      const result = transactionModule.createZoteroImportPlanTransaction({ snapshot, importPlan, createdAt });
      return {
        status: "zoteroImportPlanCreated",
        importPlan,
        snapshot: result.snapshot,
        records: createPanelRecords(result.snapshot, { topicId })
      };
    }

    function createPanelRecords(snapshot, { selectedWorkId, filters, topicId } = {}) {
      return {
        recentDrafts: paperSummaryModule.listRecentSummaryDrafts(snapshot),
        recentGraphSeeds: paperSummaryModule.listRecentGraphSeeds(snapshot),
        recentTaskLedger: paperSummaryModule.listRecentTaskLedger(snapshot),
        graphReview: graphReviewWorkflowModule.createGraphReviewReadModel({
          snapshot,
          selectedWorkId,
          filters
        }),
        aiTaskWorkspace: aiTaskWorkspaceModule.createAiTaskWorkspaceReadModel(snapshot),
        literatureDiscovery: literatureDiscoveryModule.createLiteratureDiscoveryReadModel(snapshot, { topicId }),
        candidateReview: candidateReviewModule.createCandidateReviewReadModel(snapshot, { topicId }),
        zoteroWriteQueue: zoteroWriteQueueModule.createZoteroWriteQueueReadModel(snapshot, { topicId }),
        etherealReference: etherealReferenceGraphModule.createEtherealReferenceReadModel(snapshot, { topicId })
      };
    }

    return {
      captureGraphSeedWorkflow,
      confirmAiTaskWorkspacePlanWorkflow,
      confirmDraftSavedToZoteroWorkflow,
      createAiTaskWorkspacePlanWorkflow,
      createLiteratureDiscoveryPlanWorkflow,
      createPanelRecords,
      createReadingTranslationDraftWorkflow,
      createSummaryDraftWorkflow,
      createZoteroImportPlanWorkflow,
      markDocumentCandidateReviewedWorkflow,
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

  function resolveLiteratureDiscoveryModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./literatureDiscovery");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchLiteratureDiscovery;
    }
    return null;
  }

  function resolveCandidateReviewModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./documentCandidateReview");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchDocumentCandidateReview;
    }
    return null;
  }

  function resolveZoteroWriteQueueModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./zoteroWriteQueue");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchZoteroWriteQueue;
    }
    return null;
  }

  function resolveEtherealReferenceGraphModule(moduleOverride) {
    if (moduleOverride) {
      return moduleOverride;
    }
    if (typeof require === "function") {
      return require("./etherealReferenceGraph");
    }
    if (typeof window !== "undefined") {
      return window.WorkbenchEtherealReferenceGraph;
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
    assertFunction(moduleValue, "createLiteratureDiscoveryPlanTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "createResearchNoteDraftTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "createZoteroImportPlanTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "markDocumentCandidateReviewedTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "recordAiTaskQueueResultTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "recordAiTaskQueueResultWithDraftsTransaction", "WorkbenchLocalStoreTransaction Module");
    assertFunction(moduleValue, "recordLiteratureDiscoveryCandidatesTransaction", "WorkbenchLocalStoreTransaction Module");
  }

  function assertAiTaskWorkspaceModule(moduleValue) {
    assertFunction(moduleValue, "createAiTaskWorkspaceReadModel", "WorkbenchAiTaskWorkspace Module");
    assertFunction(moduleValue, "createCurrentSelectionAiJobPlan", "WorkbenchAiTaskWorkspace Module");
  }

  function assertLiteratureDiscoveryModule(moduleValue) {
    assertFunction(moduleValue, "createLiteratureDiscoveryJobPlan", "WorkbenchLiteratureDiscovery Module");
    assertFunction(moduleValue, "createLiteratureDiscoveryReadModel", "WorkbenchLiteratureDiscovery Module");
  }

  function assertCandidateReviewModule(moduleValue) {
    assertFunction(moduleValue, "createCandidateReviewReadModel", "WorkbenchDocumentCandidateReview Module");
    assertFunction(moduleValue, "createZoteroImportPlanFromCandidates", "WorkbenchDocumentCandidateReview Module");
  }

  function assertZoteroWriteQueueModule(moduleValue) {
    assertFunction(moduleValue, "createZoteroWriteQueueReadModel", "WorkbenchZoteroWriteQueue Module");
  }

  function assertEtherealReferenceGraphModule(moduleValue) {
    assertFunction(moduleValue, "createEtherealReferenceReadModel", "WorkbenchEtherealReferenceGraph Module");
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
