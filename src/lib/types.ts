export type TopNavItem = {
  label: string;
  href: string;
  matchPrefixes?: string[];
};

export type TopNavData = {
  productName: string;
  items: TopNavItem[];
  identityLabel: string;
  privacyNote?: string;
};

export type SectionIntro = {
  title: string;
  subtitle?: string;
};

export type FocusSummaryData = {
  title: string;
  mainFocusAreas: string[];
  lessAttendedArea: string;
  strongestGrowthArea: string;
  summaryText: string;
};

export type HeroAction = {
  label: string;
  href: string;
  helperText?: string;
};

export type HeroData = {
  greeting: string;
  title: string;
  subtitle: string;
  statusLine: string;
  actions: HeroAction[];
};

export type LifeArea = {
  slug: string;
  href: string;
  title: string;
  currentFocus: string;
  lifeProgress: string[];
  languageGrowth: string[];
  currentBlock: string;
  primaryAction: string;
  secondaryActions: string[];
};

export type CrossDomainHint = {
  text: string;
};

export type QuickAction = {
  title: string;
  href: string;
  description: string;
};

export type GrowthTodayData = {
  title: string;
  subtitle: string;
  newTermsCount: number;
  newExpressionsCount: number;
  newTemplatesCount: number;
  personalInsightCount: number;
  strongestArea: string;
  expressionToCarryTomorrow: string;
};

export type EveningReviewData = {
  title: string;
  summary: string;
  strongestArea: string;
  neglectedArea: string;
  keyGrowthType: string;
  primaryAction: string;
  secondaryAction: string;
};

export type HomePageData = {
  topNav: TopNavData;
  hero: HeroData;
  focusSummary: FocusSummaryData;
  lifeMapIntro: SectionIntro;
  lifeAreas: LifeArea[];
  crossDomainIntro: SectionIntro;
  crossDomainHints: CrossDomainHint[];
  quickActionsIntro: SectionIntro;
  quickActions: QuickAction[];
  growthToday: GrowthTodayData;
  eveningReview: EveningReviewData;
};

export type SourceTypeConfig = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type CategoryConfig = {
  id: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
};

export type OutputFormat =
  | "wordpress_article"
  | "medium_article"
  | "substack_newsletter"
  | "x_thread"
  | "linkedin_post"
  | "devto_article"
  | "youtube_shorts_script"
  | "seo_metadata"
  | "product_faq"
  | "custom";

export type PlatformConfig = {
  id: string;
  name: string;
  description: string;
  platformType: "blog" | "newsletter" | "social" | "video" | "developer" | "custom";
  supportedFormats: OutputFormat[];
  publishMode: "manual" | "draft" | "auto";
  enabled: boolean;
};

export type ProductConfig = {
  id: string;
  name: string;
  description: string;
  audience: string;
  defaultCTA: string;
  enabled: boolean;
};

export type RoutingRule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  when: {
    sourceTypeIds?: string[];
    categoryIds?: string[];
    moduleIds?: string[];
    productIds?: string[];
    keywords?: string[];
  };
  then: {
    platformIds: string[];
    outputFormats: OutputFormat[];
    publishMode: "manual" | "draft" | "auto";
    rewriteDepth: "light" | "medium" | "deep";
    defaultCTA?: string;
  };
};

export type RoutingConfigs = {
  sourceTypeConfigs: SourceTypeConfig[];
  categoryConfigs: CategoryConfig[];
  platformConfigs: PlatformConfig[];
  productConfigs: ProductConfig[];
};

export type LegacyAiTranslationStrategy = "直译" | "本地化改写" | "深度重写";

export type LegacyAiSettings = {
  defaultProvider: string;
  defaultModel: string;
  defaultOutputLanguage: string;
  defaultTone: string;
  defaultTranslationStrategy: LegacyAiTranslationStrategy;
  autoGenerateMultiPlatformOutputs: boolean;
};

export type AiProviderFamily =
  | "openai"
  | "gemini"
  | "anthropic"
  | "claude"
  | "qwen"
  | "deepseek"
  | "glm"
  | "moonshot"
  | "kimi"
  | "minimax"
  | "local"
  | "custom";

export type AiProviderConnectionMode = "official" | "compatible" | "custom_base_url";
export type AiProviderKind = "native" | "openai_compatible" | "custom" | "local";
export type AiAdapterProtocol =
  | "openai_chat_completions"
  | "openai_images"
  | "gemini_native"
  | "anthropic_messages"
  | "custom_rest";
export type AiEndpointMode =
  | "chat_completions"
  | "responses"
  | "image_generations"
  | "image_edits"
  | "gemini_generate_content"
  | "anthropic_messages"
  | "custom";

export type AiVerificationRecord = {
  status: AiCapabilityVerificationStatus;
  checkedAt?: string;
  requestUrl?: string;
  message?: string;
};

export type AiProviderConfig = {
  id: string;
  name: string;
  displayName?: string;
  providerKind?: AiProviderKind;
  providerFamily: AiProviderFamily;
  providerType: "openai_official" | "openai_compatible" | "custom_rest" | "local";
  connectionMode: AiProviderConnectionMode;
  adapterProtocol?: AiAdapterProtocol;
  baseUrl: string;
  endpointMode?: AiEndpointMode;
  customEndpointPath?: string;
  sourcePresetId?: string;
  credentialRef?: string;
  /** @deprecated Use credentialRef plus desktop secret storage in future phases. */
  apiKeyRef?: string;
  apiKeyRequired?: boolean;
  authMode: "bearer" | "header" | "google_api_key" | "anthropic_api_key" | "none";
  authHeaderName?: string;
  extraHeaders?: Array<{
    id: string;
    name: string;
    value: string;
    enabled?: boolean;
  }>;
  isLocal?: boolean;
  isRemote?: boolean;
  allowSensitiveContent?: boolean;
  allowFullMaterial?: boolean;
  timeoutMs?: number;
  enabled: boolean;
  connectionVerification?: AiVerificationRecord;
  notes?: string;
};

export type AiModelCapability =
  | "text"
  | "analysis"
  | "rewrite"
  | "publish_package"
  | "video_script"
  | "vision"
  | "image"
  | "structured_output"
  | "reasoning"
  | "streaming";

export type AiCapabilityVerificationStatus = "unverified" | "verified" | "failed";
export type AiReasoningEffort = "provider_default" | "off" | "low" | "medium" | "high";

export type AiModelCapabilityVerification = {
  text?: AiCapabilityVerificationStatus;
  image?: AiCapabilityVerificationStatus;
  structuredOutput?: AiCapabilityVerificationStatus;
  reasoning?: AiCapabilityVerificationStatus;
  streaming?: AiCapabilityVerificationStatus;
};

export type AiModelCapabilityVerificationDetails = {
  text?: AiVerificationRecord;
  image?: AiVerificationRecord;
};

export type AiModelConfig = {
  id: string;
  providerId: string;
  modelId: string;
  modelName?: string;
  displayName: string;
  capabilities: AiModelCapability[];
  contextWindowTokens?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  timeoutMs?: number;
  supportsText?: boolean;
  supportsJsonMode?: boolean;
  supportsVision?: boolean;
  supportsStructuredOutput?: boolean;
  supportsReasoning?: boolean;
  supportsStreaming?: boolean;
  reasoningEffort?: AiReasoningEffort;
  capabilityVerification?: AiModelCapabilityVerification;
  capabilityVerificationDetails?: AiModelCapabilityVerificationDetails;
  isLocal?: boolean;
  allowFullMaterial?: boolean;
  allowSensitiveContent?: boolean;
  enabled: boolean;
};

export type AiTaskContentPolicy =
  | "selected_text_only"
  | "current_segment_only"
  | "source_overview_only"
  | "source_material"
  | "feynman_note_only"
  | "output_draft_context_only"
  | "content_item"
  | "default";

export type AiTaskRoute = {
  providerId: string;
  modelId: string;
  enabled?: boolean;
  requireUserConfirmForRemote?: boolean;
  contentPolicy?: AiTaskContentPolicy;
  temperatureOverride?: number;
  maxTokensOverride?: number;
};

export type AiContentScope =
  | "selected_text_only"
  | "current_segment_only"
  | "source_overview_only"
  | "source_material_full_or_truncated"
  | "feynman_note_only"
  | "output_draft_context_only"
  | "content_pipeline_item"
  | "publish_package_context"
  | "video_script_context"
  | "image_upload"
  | "unknown";

export type AiSendPlan = {
  id: string;
  task: keyof AiTaskRouting;
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  isRemote: boolean;
  isLocal: boolean;
  contentScope: AiContentScope;
  estimatedContentLength: number;
  includesFullMaterial: boolean;
  includesSensitiveContent: boolean;
  requiresUserConfirmation: boolean;
  warning?: string;
  createdAt: string;
};

export type AiSendPolicyResult = {
  allowed: boolean;
  reason?: string;
  warning?: string;
  requiresUserConfirmation: boolean;
};

export type AiPrivacySettings = {
  allowRemoteAi: boolean;
  onlyUseLocalModels: boolean;
  requireConfirmationBeforeRemoteSend: boolean;
  allowFullMaterialToRemote: boolean;
  allowSensitiveContentToRemote: boolean;
};

export type AiTaskRouting = {
  analysis: AiTaskRoute;
  languageAnalysis?: AiTaskRoute;
  phraseAnalysis?: AiTaskRoute;
  sentenceGrammarAnalysis?: AiTaskRoute;
  segmentAnalysis?: AiTaskRoute;
  feynmanFeedback?: AiTaskRoute;
  outputDraft?: AiTaskRoute;
  contentAnalysis?: AiTaskRoute;
  rewrite: AiTaskRoute;
  publishPackage: AiTaskRoute;
  videoScript: AiTaskRoute;
  imageTextExtraction?: AiTaskRoute;
  imageGeneration?: AiTaskRoute;
  imageEditing?: AiTaskRoute;
};

export type AiContentPreferences = {
  defaultOutputLanguage: "en" | "zh";
  rewriteTone: "natural" | "professional" | "calm" | "direct";
  rewriteStrategy: "literal" | "localized" | "deep_rewrite";
  autoGenerateMultiPlatformVersions: boolean;
};

export type AiConnectionTestResult = {
  success: boolean;
  message: string;
  providerId: string;
  modelId?: string;
  capability?: "text" | "image";
  protocol?: AiAdapterProtocol;
  requestUrl?: string;
  checkedAt?: string;
};

export type ContentAiAnalysis = {
  recommendedAudience: string;
  recommendedPlatforms: string[];
  recommendedProducts: string[];
  recommendedFormats: OutputFormat[];
  reasoning: string;
  aiStatus: "idle" | "analyzed" | "rewritten";
  modelUsed: string;
  processedAt: string;
};

export type RewrittenOutputEntry = {
  title: string;
  subtitle?: string;
  hook?: string;
  body?: string;
  posts?: string[];
  script?: string;
  cta: string;
  modelUsed: string;
  generatedAt: string;
};

export type RewrittenOutputs = {
  wordpressEnDraft?: RewrittenOutputEntry;
  mediumEnDraft?: RewrittenOutputEntry;
  substackEnDraft?: RewrittenOutputEntry;
  xThreadDraft?: RewrittenOutputEntry;
  linkedInDraft?: RewrittenOutputEntry;
  youtubeDraft?: RewrittenOutputEntry;
  wordpressEn?: RewrittenOutputEntry;
  mediumEn?: RewrittenOutputEntry;
  substackEn?: RewrittenOutputEntry;
  xThreadEn?: RewrittenOutputEntry;
  linkedInEn?: RewrittenOutputEntry;
  youtubeShortsEn?: RewrittenOutputEntry;
};

export type ContentInputMethod =
  | "direct_paste"
  | "url"
  | "file_upload"
  | "local_asset"
  | "title_only";

export type ContentIngestStatus =
  | "saved_only"
  | "ingesting"
  | "ingested"
  | "partial"
  | "failed";

export type ContentAssetType =
  | "url"
  | "file"
  | "directory"
  | "text"
  | "markdown"
  | "json"
  | "csv"
  | "html"
  | "pdf"
  | "docx"
  | "image"
  | "unknown";

export type ContentPipelineItem = {
  id: string;
  title: string;
  description: string;
  sourceTypeId: string;
  inputMethod?: ContentInputMethod;
  sourceReference?: string;
  sourceFileName?: string;
  sourceFileExt?: string;
  sourceMimeType?: string;
  sourceAssetType?: ContentAssetType;
  originalLanguage?: "zh" | "en";
  summary?: string;
  rawContent?: string;
  extractedText?: string;
  ingestStatus?: ContentIngestStatus;
  ingestError?: string;
  ingestedAt?: string;
  categoryIds: string[];
  moduleIds?: string[];
  productIds?: string[];
  keywords?: string[];
  targetPlatformIds?: string[];
  targetAudience?: string;
  linkedOfferId?: string;
  primaryCTA?: string;
  notes?: string;
  createdAt?: string;
  analysis?: ContentAiAnalysis;
  rewrittenOutputs?: RewrittenOutputs;
  status: "raw" | "待整理" | "改写中" | "准备发布";
};

export type PublishingRecommendation = {
  recommendedPlatforms: PlatformConfig[];
  recommendedOutputFormats: OutputFormat[];
  publishMode: "manual" | "draft" | "auto";
  rewriteDepth: "light" | "medium" | "deep";
  cta: string;
  matchedRuleIds: string[];
  explanation: string;
};

export type Offer = {
  id: string;
  name: string;
  description: string;
  whatItIs?: string;
  problemItSolves?: string;
  grownFromContentIds?: string[];
  offerType: "service" | "template" | "tool" | "report" | "waitlist" | "lead_magnet";
  linkedProductId?: string;
  targetAudience: string;
  priceHint: string;
  deliveryTime: string;
  deliverables: string[];
  primaryCTA: string;
  status: "idea" | "draft" | "testable" | "selling" | "paused";
  relatedCategoryIds: string[];
  relatedPlatformIds: string[];
};

export type ContentConversion = {
  contentItemId: string;
  linkedOfferId?: string;
  clicks: number;
  subscribers: number;
  inquiries: number;
  purchases: number;
  conversionStatus: "none" | "clicked" | "subscribed" | "inquired" | "purchased";
};

export type OfferRecommendation = {
  offer: Offer | null;
  explanation: string;
};

export type ConversionSummary = {
  totalClicks: number;
  totalSubscribers: number;
  totalInquiries: number;
  totalPurchases: number;
  bestOfferId: string;
  suggestedNextAction: string;
};

export type PublishArticleBlock = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  formattedBody?: string;
  tags: string[];
  cta: string;
  seoTitle?: string;
  metaDescription?: string;
};

export type PublishMediumBlock = {
  title: string;
  subtitle: string;
  body: string;
  formattedBody?: string;
  tags: string[];
  cta: string;
};

export type PublishNewsletterBlock = {
  subject: string;
  previewText: string;
  body: string;
  formattedBody?: string;
  cta: string;
  postscript?: string;
};

export type PublishThreadBlock = {
  posts: string[];
  cta: string;
};

export type PublishLinkedInBlock = {
  hook: string;
  body: string;
  formattedBody?: string;
  bullets?: string[];
  cta: string;
};

export type PublishShortsBlock = {
  title: string;
  hook: string;
  script: string;
  sceneScript?: string;
  narration?: string;
  onScreenText?: string;
  cta: string;
};

export type PublishSeoMetadata = {
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalHint: string;
};

export type PublishPackage = {
  id: string;
  contentItemId: string;
  linkedOfferId?: string;
  wordpressArticle: PublishArticleBlock;
  mediumArticle: PublishMediumBlock;
  substackNewsletter: PublishNewsletterBlock;
  xThread: PublishThreadBlock;
  linkedInPost: PublishLinkedInBlock;
  youtubeShortsScript: PublishShortsBlock;
  seoMetadata: PublishSeoMetadata;
  createdAt: string;
};

export type PackageGenerationResult = {
  package: PublishPackage;
  explanation: string;
};

export type InboxDraft = {
  title: string;
  sourceTypeId: string;
  inputMethod: ContentInputMethod;
  sourceReference: string;
  sourceFileName?: string;
  sourceFileExt?: string;
  sourceMimeType?: string;
  sourceAssetType?: ContentAssetType;
  originalLanguage: "zh" | "en";
  summary: string;
  rawContent: string;
  moduleId: string;
  categoryIds: string[];
  productIds: string[];
  targetAudience: string;
  preferredPlatformIds: string[];
  productMode: "auto" | "none" | "existing" | "new";
  selectedOfferId?: string;
  newOfferName?: string;
  newOfferDescription?: string;
  platformMode: "auto" | "manual" | "new" | "none";
  newPlatformName?: string;
  newPlatformDescription?: string;
  rewriteDepth: "light" | "medium" | "deep";
  primaryCTA?: string;
  notes?: string;
};

export type InboxSubmissionResult = {
  contentItemId: string;
  message: string;
};

export type VideoTargetPlatform =
  | "youtube_shorts"
  | "tiktok"
  | "instagram_reels"
  | "custom";

export type VideoContentType =
  | "explainer"
  | "tutorial"
  | "case_study"
  | "product_intro"
  | "symbolic_story"
  | "workflow_demo";

export type VideoDurationSec = 30 | 45 | 60 | 90;

export type VideoPromptTemplate = {
  id: string;
  name: string;
  description: string;
  scope: "system" | "user";
  applicablePlatforms: VideoTargetPlatform[];
  videoType: VideoContentType;
  durationSec: VideoDurationSec;
  tone: string;
  visualStyle: string;
  promptTemplate: string;
  variables: string[];
  enabled: boolean;
};

export type VideoGenerationDraft = {
  contentItemId: string;
  offerId?: string;
  templateId?: string;
  targetPlatform: VideoTargetPlatform;
  videoType: VideoContentType;
  durationSec: VideoDurationSec;
  tone: string;
  visualStyle: string;
  promptTemplate: string;
  modelUsed?: string;
  generatedAt?: string;
  title?: string;
  hook?: string;
  sceneScript?: string;
  narration?: string;
  onScreenText?: string;
  scenes?: VideoScene[];
  remotionProps?: RemotionVideoProps;
  resolvedPrompt?: string;
  explanation?: string;
};

export type VideoScene = {
  id: string;
  sceneNumber: number;
  narration: string;
  onScreenText: string;
  visualHint: string;
  durationSec: number;
};

export type RemotionVideoProps = {
  title: string;
  contentItemId: string;
  offerId?: string;
  platform: VideoTargetPlatform;
  videoType: VideoContentType;
  durationSec: VideoDurationSec;
  fps: number;
  width: number;
  height: number;
  cta: string;
  tone: string;
  visualStyle: string;
  scenes: VideoScene[];
  generatedFromPrompt: string;
};

export type VideoGenerationResult = {
  scenes: VideoScene[];
  remotionProps: RemotionVideoProps;
  resolvedPrompt: string;
  explanation: string;
};

export type AutomationConnectionConfig = {
  id: string;
  name: string;
  connectionType:
    | "n8n_webhook"
    | "make_webhook"
    | "wordpress_draft"
    | "devto_draft"
    | "manual_checklist";
  endpoint: string;
  enabled: boolean;
  notes?: string;
};

export type LearningGoalStatus = "active" | "paused" | "completed" | "archived";

export type LearningGoal = {
  id: string;
  title: string;
  description: string;
  targetLanguage: string;
  nativeLanguage: string;
  interestArea: string;
  status: LearningGoalStatus;
  createdAt: string;
  updatedAt: string;
};

export type LanguageSettings = {
  uiLanguage: string;
  targetLanguage: string;
  explanationLanguage: string;
};

export type SourceMaterialType = "text" | "url" | "file" | "ai_generated" | "question";

export type SourceMaterial = {
  id: string;
  goalId: string;
  title: string;
  sourceType: SourceMaterialType;
  language: string;
  originalContent: string;
  cleanedContent: string;
  url?: string;
  fileName?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type LearningSegment = {
  id: string;
  sourceMaterialId: string;
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
  createdAt: string;
};

export type ReadingSession = {
  id: string;
  sourceMaterialId: string;
  goalId: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  progress: number;
  currentSegmentIndex: number;
  savedVocabularyIds: string[];
  savedExpressionIds: string[];
  notes: string;
};

export type SegmentAnalysis = {
  id: string;
  sourceMaterialId: string;
  segmentId: string;
  summary: string;
  difficulty: string;
  vocabularyCandidateIds: string[];
  expressionCandidateIds: string[];
  grammarNoteIds: string[];
  cultureNoteIds: string[];
  logicNotes: string;
  createdAt: string;
  articleOverview?: LanguageArticleOverview;
  vocabularyCandidates?: VocabularyCandidate[];
  expressionCandidates?: ExpressionCandidate[];
  grammarCandidates?: GrammarCandidate[];
  cultureCandidates?: CultureCandidate[];
  logicReview?: LogicReview;
  learningSuggestions?: LearningSuggestion[];
  rawModelOutput?: string;
  status?: "idle" | "analyzing" | "completed" | "failed";
  errorMessage?: string;
};

export type LearningItemStatus = "new" | "learning" | "known" | "ignored";

export type SrsRating = "again" | "hard" | "good" | "easy";
export type SrsCardState = "New" | "Learning" | "Review" | "Relearning";

export type SrsReviewLogEntry = {
  id: string;
  rating: SrsRating;
  reviewedAt: string;
  dueAt: string;
  state: SrsCardState;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
};

export type SrsState = {
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: SrsCardState;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  reviewHistory: SrsReviewLogEntry[];
};

export type LanguageArticleOverview = {
  title: string;
  topic: string;
  summaryZh: string;
  summaryInTargetLanguage: string;
  difficulty: string;
  readingGoal: string;
  keyIdeas: string[];
};

export type VocabularyCandidate = {
  text: string;
  lemma: string;
  partOfSpeech: string;
  sentence: string;
  meaningZh: string;
  meaningEn: string;
  reason: string;
  level: string;
  segmentId?: string;
};

export type ExpressionCandidate = {
  text: string;
  type:
    | "collocation"
    | "phrasal_verb"
    | "idiom"
    | "fixed_expression"
    | "sentence_pattern"
    | "other";
  sentence: string;
  meaningZh: string;
  meaningEn: string;
  usageNote: string;
  reason: string;
  segmentId?: string;
};

export type GrammarCandidate = {
  title: string;
  sentence: string;
  explanationZh: string;
  explanationEn: string;
  importance: number;
  segmentId?: string;
};

export type CultureCandidate = {
  title: string;
  term: string;
  culturalContext: string;
  explanationZh: string;
  explanationEn: string;
  segmentId?: string;
};

export type LogicReview = {
  structure: string;
  authorPosition: string;
  keyArguments: string[];
  implicitAssumptions: string[];
  usefulQuestions: string[];
};

export type LearningSuggestion = {
  title: string;
  reason: string;
  action: string;
};

export type LanguageAnalysisResult = {
  sourceMaterialId: string;
  articleOverview: LanguageArticleOverview;
  vocabularyCandidates: VocabularyCandidate[];
  expressionCandidates: ExpressionCandidate[];
  grammarCandidates: GrammarCandidate[];
  cultureCandidates: CultureCandidate[];
  logicReview: LogicReview;
  learningSuggestions: LearningSuggestion[];
  createdAt: string;
  rawModelOutput?: string;
  status?: "completed" | "failed";
  errorMessage?: string;
  modelUsed?: string;
};

export type VocabularyItem = {
  id: string;
  text: string;
  lemma: string;
  pronunciation?: string;
  language: string;
  partOfSpeech: string;
  meaningZh: string;
  meaningEn: string;
  sourceMaterialId: string;
  segmentId: string;
  sentence: string;
  status: LearningItemStatus;
  stage: number;
  tags: string[];
  srs?: SrsState;
  createdAt: string;
  updatedAt: string;
};

export type ExpressionItemType =
  | "collocation"
  | "phrasal_verb"
  | "idiom"
  | "fixed_expression"
  | "sentence_pattern"
  | "other";

export type ExpressionItem = {
  id: string;
  text: string;
  language: string;
  type: ExpressionItemType;
  meaningZh: string;
  meaningEn: string;
  usageNote: string;
  sourceMaterialId: string;
  segmentId: string;
  sentence: string;
  status: LearningItemStatus;
  stage: number;
  tags: string[];
  srs?: SrsState;
  createdAt: string;
  updatedAt: string;
};

export type GrammarNote = {
  id: string;
  title: string;
  language: string;
  explanationZh: string;
  explanationEn: string;
  sourceMaterialId: string;
  segmentId: string;
  sentence: string;
  importance: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CultureNote = {
  id: string;
  title: string;
  language: string;
  term: string;
  explanationZh: string;
  explanationEn: string;
  sourceMaterialId: string;
  segmentId: string;
  culturalContext: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type FeynmanNote = {
  id: string;
  sourceMaterialId: string;
  readingSessionId: string;
  goalId: string;
  userExplanation: string;
  personalConnection: string;
  actionInsight: string;
  aiFeedback: string;
  clarityScore: number;
  accuracyScore: number;
  createdAt: string;
  updatedAt: string;
  mainIdea?: string;
  ownWordsExplanation?: string;
  questions?: string;
  nextSteps?: string;
  feedbackStrengths?: string[];
  feedbackMissingPoints?: string[];
  feedbackLanguageSuggestions?: string[];
  feedbackNextQuestions?: string[];
};

export type FeynmanFeedback = {
  clarityScore: number;
  accuracyScore: number;
  strengths: string[];
  possibleMisunderstandings: string[];
  missingKeyPoints: string[];
  languageSuggestions: string[];
  nextQuestions: string[];
  actionSuggestions: string[];
  feedbackSummary: string;
};

export type KnowledgeNodeType = "idea" | "concept" | "insight" | "question" | "plan" | "project";

export type KnowledgeNode = {
  id: string;
  title: string;
  type: KnowledgeNodeType;
  sourceMaterialId: string;
  feynmanNoteId: string;
  content: string;
  tags: string[];
  relatedNodeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  sourceMaterialId: string;
  feynmanNoteId: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type OutputDraftType =
  | "blog"
  | "linkedin"
  | "x"
  | "medium"
  | "substack"
  | "video_script"
  | "product_idea"
  | "plan";

export type OutputDraft = {
  id: string;
  sourceMaterialId: string;
  feynmanNoteId: string;
  knowledgeNodeId: string;
  outputType: OutputDraftType;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishVisualSettings?: import("./publish/publishPresets").PublishVisualSettings;
  publishDraftSettings?: import("./publish/publishPresets").PublishDraftSettings;
  publishSourceChoiceIds?: string[];
  publishCustomInput?: string;
};

export type ReaderMessage = {
  id: string;
  sourceMaterialId: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type WorkspaceState = {
  schemaVersion: number;
  languageSettings: LanguageSettings;
  aiProviders: AiProviderConfig[];
  aiModels: AiModelConfig[];
  aiTaskRouting: AiTaskRouting;
  aiContentPreferences: AiContentPreferences;
  aiPrivacySettings: AiPrivacySettings;
  automationConnections: AutomationConnectionConfig[];
  currentContentId: string;
  recentSavedContentIds: string[];
  contentPipelineItems: ContentPipelineItem[];
  offers: Offer[];
  contentConversions: ContentConversion[];
  publishPackages: PublishPackage[];
  videoPromptTemplates: VideoPromptTemplate[];
  videoGenerationDrafts: VideoGenerationDraft[];
  sourceTypeConfigs: SourceTypeConfig[];
  categoryConfigs: CategoryConfig[];
  platformConfigs: PlatformConfig[];
  productConfigs: ProductConfig[];
  routingRules: RoutingRule[];
  learningGoals: LearningGoal[];
  sourceMaterials: SourceMaterial[];
  learningSegments: LearningSegment[];
  readingSessions: ReadingSession[];
  segmentAnalyses: SegmentAnalysis[];
  vocabularyItems: VocabularyItem[];
  expressionItems: ExpressionItem[];
  grammarNotes: GrammarNote[];
  cultureNotes: CultureNote[];
  feynmanNotes: FeynmanNote[];
  readerMessages: ReaderMessage[];
  knowledgeNodes: KnowledgeNode[];
  actionItems: ActionItem[];
  outputDrafts: OutputDraft[];
};

export type WorkspaceExport = {
  exportedAt: string;
  appName: string;
  workspace: WorkspaceState;
};

export type WorkspaceFileMetadata = {
  filePath?: string;
  lastSavedAt?: string;
  backupCount?: number;
};

export type WorkspaceFile = {
  schemaVersion: number;
  appName: string;
  exportedAt: string;
  workspace: WorkspaceState;
  metadata: WorkspaceFileMetadata;
};
