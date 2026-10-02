# Changelog

All notable changes to the `@henrikrexed/openclaw-otel-observability` plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0](https://github.com/th-m-vogel/openclaw-observability-plugin/compare/v0.9.2...v0.5.0) (2026-10-02)


### Features

* add 5 Tetragon policies for 2025-2026 AI agent security threats ([a083c47](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a083c47c1d9ca70165452efe39d61e37d85538cd))
* add 5 Tetragon policies for 2025-2026 AI agent security threats ([a94f08e](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a94f08ecbbbdeca3fa10d0da0bbdd02990927c00))
* add Dynatrace dashboard templates for OpenClaw observability ([2265b9f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2265b9f4bee21f75753b42a1a2f7861b0369cb46))
* add filelog receiver for OpenClaw gateway logs ([5b1ff63](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/5b1ff6391ba1e1532c058ade10a53cd8b68c1e6b))
* add Tetragon kernel security monitoring ([3a3e574](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3a3e574cb85df20ddbf30ac7985e43cef6a3f0bd))
* **dashboard:** add plugin-only dashboard using collected metrics/spans/logs ([b544fa0](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b544fa054df082a270ec002804dabc3af7bf8392))
* **dashboard:** align repo OpenClaw overview to V3 spans (ISI-1007) ([c250fe1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c250fe1a11715dd5875cc9a861b62070e89cc57e))
* **dashboard:** align repo OpenClaw overview to V3 spans (ISI-1007) ([511201f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/511201f98ed7cb4659e003109150deff8ac3f0cd))
* **diagnostics:** add memory.sample + memory.pressure event support ([c30a2e8](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c30a2e8a70f726a633ebb29fe4cbf9cec13a9629))
* **diagnostics:** memory.sample + memory.pressure event support ([bf52daf](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/bf52daff8486c094bd0b165cb5f253e782b797d1))
* initial OpenTelemetry observability plugin ([4e9f577](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/4e9f57798b23c0c40e69ceaf96c2814cb402a92e))
* integrate with OpenClaw diagnostics API for cost tracking ([d223d9c](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d223d9c81b5985044508e9b083ec4f8c12880aec))
* **ISI-1017:** add queue and session state metrics ([d8ac76f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d8ac76f503ffca56f3ecd0d9604014d18576cbff))
* **ISI-1017:** add queue and session state metrics ([7ca1d20](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/7ca1d2006b7e6a7817e98f5df364c7696e3a4c49))
* **ISI-1017:** add queue and session state metrics ([1814f3a](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/1814f3ac3eaebf6be21b55d4156b708724d527aa))
* **ISI-1018:** add context layer and skill usage tracking ([473833c](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/473833c9bc4faf403dcbb5945da21588dbc270bf))
* **ISI-1018:** add context layer and skill usage tracking ([2410d66](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2410d662da488845def3f1f59b31c4cbbd7efe38))
* **ISI-1019:** add subagent deep tracing enhancements ([cf0bf88](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/cf0bf88c480f85897a3e4d76463cb213435aef9b))
* **ISI-1019:** add subagent deep tracing enhancements ([a8706f6](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a8706f6cddc80b595a32ecccf5fe232fb1cc740c))
* **ISI-1020:** add webhook observability ([2f91324](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2f9132442a20b0c15d5babeb732e3711c519f828))
* **ISI-1020:** add webhook observability ([b6d48a2](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b6d48a2bbae52b7884457bca88af272aa03205ec))
* **ISI-1318:** bounded redacted error_preview on failed tool spans ([bebeafe](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/bebeafef30f6953fb2b528e768568c6d5585e19c))
* **ISI-1318:** bounded redacted error_preview on failed tool spans ([5874839](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/58748393b715abd968fe90a135d650ebdf53bd34))
* **ISI-1605:** gen_ai content semconv keys for Dynatrace AI Observability ([c41734f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c41734f328e2ca22afd775731497528962bd6f09))
* **ISI-1605:** gen_ai content semconv keys for Dynatrace AI Observability ([e5a6ecf](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/e5a6ecf8903d7f1a92761201a9f37443d882b2bb))
* **ISI-1627:** subagent_spawned migration + end-to-end trace propagation ([b7ebd08](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b7ebd08044410104c3e2af085ef0c6b15f128cba))
* **ISI-1627:** subagent_spawned migration + end-to-end trace propagation ([0bda813](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0bda813d3f3c162b03b32657835bdcbd1ce6b216))
* **ISI-1628:** compaction spans + metrics (before/after_compaction) ([c6343f6](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c6343f6c0bbbfa1664c73513fe561527dd636ee5))
* **ISI-1628:** compaction spans + metrics (before/after_compaction) ([6684ad4](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/6684ad4c4cfe79f10caedae644abfa3b2090cfba))
* **otel:** configurable trace sampling rate (ISI-998) ([32afcdf](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/32afcdf491a66f16cad1cf3c26adada0e1fe8d44))
* **otel:** configurable trace sampling rate (ISI-998) ([acd6a7c](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/acd6a7ca0a736faa97c1f9c074a1c3cc9ebe7680))
* **otel:** granular ContentCapturePolicy for span content capture (ISI-1000) ([592920d](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/592920d565c40c7c19526ceb27513e8ac4a33b8e))
* **otel:** granular ContentCapturePolicy for span content capture (ISI-1000) ([aa207b1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/aa207b1af2b22bdd496195da3904691035449130))
* **otel:** W3C trace context propagation (ISI-1001) ([53695b1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/53695b19587653c2c2783c295611aabd9f655ca9))
* **otel:** W3C trace context propagation for distributed tracing (ISI-1001) ([95e2178](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/95e217888c8ba09af5ce03bf85553be4381161b0))
* **otel:** wire OTLP log export pipeline into plugin lifecycle (ISI-997) ([d26944c](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d26944c43aea667a5ab0546d538afe7916c08d43))
* **otel:** wire OTLP log export pipeline into plugin lifecycle (ISI-997) ([e46a236](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/e46a2367623581f1961db718bfcf5abf410c148c))
* publish to npm + add release-please/publish workflows (ISI-947) ([20a9f62](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/20a9f62aba2f478c9df17cf06cc5524c6226b386))
* publish to npm + add release-please/publish workflows (ISI-947) ([2ba08c1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2ba08c1251b21675c5feb54eaca69c24e4b91cbe))
* replace OpenLLMetry with direct SDK wrapping for GenAI spans ([7f7b8aa](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/7f7b8aac99707431a4d7180f432cfaedb2eb59a5))
* **security:** add real-time threat detection module ([fe68abb](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/fe68abbfc723fdd1b8dcb2cbcb7b0748f80ace1d))
* **security:** redact sensitive values from trace attributes (ISI-999) ([2013060](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2013060fee00c0e2acdd7e1587d6db0df8bd4e43))
* **security:** redact sensitive values from trace attributes (ISI-999) ([675311a](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/675311af452afa3727a43075db885949e74525bc))
* wire captureContent through preload to Traceloop traceContent ([1acdc8e](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/1acdc8e8c47097fcf2ea53fb6df2ce5253089553))
* wire captureContent to Traceloop traceContent (ISI-733/ISI-734) ([480ba88](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/480ba885a0a5163abc2146531a86465ef251901c))
* wire up token consumption metrics in agent_end hook ([2d4ec54](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2d4ec54996048b013e9593ab0f6b19a7c79ca0eb))


### Bug Fixes

* add IITM ESM hook import to preload.mjs ([8b82cfa](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/8b82cfaf5e668bc6b8f7be882672117e1ff07aca))
* bypass jiti's import()-&gt;require() transform with native import ([8064c35](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/8064c351cb40d62099becb8ae9bd73f995811064))
* **collector:** add cumulativetodelta processor for Dynatrace ([cc35b77](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/cc35b77d7044fdb1f43fc6a73b8bf18871dd11ba))
* connect spans into proper traces with parent-child relationships ([2ecf6fa](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/2ecf6fa691e1d022cd975305421ac51beb03229a))
* **dashboard:** add default:0 for cache token types to handle missing data ([0407203](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0407203166c9d1f19b310ff4339afd877cc92afa))
* **dashboard:** correct hostname filter from openclaw to clawdbot ([c0eee30](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c0eee30e83ba31c313d9f6ce9923c27b27e4757a))
* **dashboard:** remove cache token types until cache usage occurs ([3661c18](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3661c189666fad11cf572f61b72742ccbed8a0fd))
* **dashboard:** use system.cpu.utilization instead of manual calculation ([0480930](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/04809303dd53caa9a198b622052df25bbfb822ba))
* detect plugin management argv sequence ([fd46dbb](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/fd46dbb5e3a687bbb628093147bc99c4ca0f5be1))
* **diagnostics:** add debug logging for all diagnostic events ([e2b53f7](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/e2b53f72c1619791eb191709c915fc6de6467843))
* **diagnostics:** add info-level logging for liveness warnings ([659e5e7](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/659e5e7f621409219b32ed43ddf67153f1506348))
* **diagnostics:** add logging to verify onDiagnosticEvent is loaded ([c7863da](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c7863daa8402c8ce56048c49e6511969782073ea))
* **diagnostics:** portable internal diagnostic events loader ([0356fbb](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0356fbbe6acc2959d2adbff32a358f9221347332))
* **diagnostics:** portable internal diagnostic events loader ([86f5d04](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/86f5d045f938b5c81ef65200fb746babc358eae6))
* **diagnostics:** portable internal diagnostic events loader ([8b40961](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/8b40961b49a4a0403cc21909d7301df2d228ed17))
* **diagnostics:** prefer internal diagnostic events over SDK wrapper ([af2a5c5](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/af2a5c526e15651e164ad4d582fefff3798b83d2))
* **diagnostics:** remove info-level logging that was causing log spam ([7cf1474](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/7cf147414270464136a7da305a96cd7bd71b0229))
* **diagnostics:** try internal diagnostic events module as fallback ([0605f4f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0605f4fc82616192147eabc8a7ea3559d25d0e00))
* **diagnostics:** try multiple paths to load diagnostic events module ([dd728fc](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/dd728fcd830551d8381aa8bebdfa922825bc3c63))
* **diagnostics:** use absolute path for internal diagnostic events module ([918d800](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/918d800b10eadf80b70f222a4dec960c652a2f56))
* **diagnostics:** wire gateway health metrics from diagnostic events ([d0cbbb8](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d0cbbb8a57967ceecb81eea9dc23db5bf8f71e8c))
* **docs:** resolve 5 issues from ISI-931 doc review ([a56ffd0](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a56ffd0491d00221d6004468ebb0c715d0a05c1f))
* extract token usage from agent_end messages array ([c0f0688](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c0f0688a27d43d0a38ea58b027cba4977f071303))
* guard against undefined unhandled rejections crashing gateway on 9.7 (ISI-9700) ([#2](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/2)) ([ff3b194](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/ff3b1943d79d43d6df92d98ccb830ee107ecb268))
* guard context utilization against zero context limit ([b3db23b](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b3db23b75dcb29c6a3022450a487bf28f11d7867))
* **hooks:** add debug logging for trace context store ([841fe60](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/841fe60dfde3c8454519872f1264f3968f338ab0))
* **hooks:** add error logging to message_received hook ([6a7a822](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/6a7a82214fc0332cfac0666b93911738f621ba29))
* **hooks:** move DIAG agent-turn verbose context dump from info to debug level ([30e8fa7](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/30e8fa752e8016a3aa78bcee451bc6b3e966e837))
* **hooks:** persist TraceContextStore across plugin reloads ([d23fe92](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d23fe92cbb9430859a1937f363a08b4b58a4c331))
* **hooks:** remove duplicate sessionKey declaration ([20cea91](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/20cea9173f9c164f285498b979f11f05288f8af8))
* **index:** register diagnostics listener at register() time, not start() ([0c567c7](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0c567c780269125a037cdd2cd0b19ec526c5411d))
* **ISI-1627:** dedupe subagent spawn span when parent has no session context ([953f1ad](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/953f1ad5bf66ca7245da8ab984c95ab90a5f2815))
* **ISI-1653:** re-parent lifecycle spans into the request/session trace ([3b02592](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3b0259217d47bb02838ac575aa520574aaba3419))
* **ISI-1653:** re-parent lifecycle spans into the request/session trace ([#67](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/67)) ([e4c1245](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/e4c12458f6a7ace0c1696cea4e4b7023974cfe64))
* **ISI-1710:** add compiled dist output + runtimeExtensions entry; guard telemetry/hooks/diagnostics init under plugin-mgmt CLI context ([bd65052](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/bd650523fb409e617cce4b64c5493f06321fb381))
* **ISI-1710:** gate OTLP log pipeline behind plugin-mgmt guard ([02fb2b3](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/02fb2b3f6962c02450c384d6c4cb6eae9d4edfb1))
* **ISI-1710:** npm packaging (compiled dist + runtimeExtensions) + plugin-mgmt lifecycle guard (GH [#68](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/68)) ([4198048](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/4198048ea123e23981f7200ad02edeb2e3c39c6d))
* **manifest:** align 0.2.0 minOpenClawVersion to 2026.4.21 (ISI-746) ([84760e9](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/84760e985cb360ac4c98608465d346e94b6f3831))
* **manifest:** align 0.2.0 minOpenClawVersion to 2026.4.21 (ISI-746) ([#19](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/19)) ([6f4123e](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/6f4123ec0b998bb77651495aa3f29e8788251c87))
* **metrics:** add periodic heartbeat to emit continuous timeseries ([b1ad468](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b1ad4686ddb561c3e565c0e7c22e7d9c89c8366f))
* **metrics:** align activeSessions gauge attributes between session_start and session_end ([952ceb0](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/952ceb0922c4a48698e2927c83e8fa9b2ca0dca2))
* **otel-logs:** stop double-converting log record timestamps to nanoseconds ([f86293f](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/f86293f1c8e5c6122a074ff9ca1097ceacfee316))
* **otel:** address PR [#30](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/30) review findings (ISI-1000) ([48eb16d](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/48eb16dd332d2902aa0891cf1842f6976ebd8c38))
* **otel:** apply code-review patches to OTLP log bridge (ISI-997) ([31a885d](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/31a885d4fd9e3eb853ecca97c1875490e046824b))
* **otel:** bring GenAI semconv emission back to registry compliance (ISI-993) ([53eda2a](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/53eda2ad14034a07e9dba6f87a5967eb304501a9))
* **otel:** bring GenAI semconv emission back to registry compliance (ISI-993) ([a825927](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a825927635164c021ef79e3e0dc48a448811536b))
* **otel:** close M1+M2 redaction gaps in content capture (ISI-1000) ([28dd485](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/28dd48575b986c8842572c5e922948371ac59342))
* **otel:** detect preloaded SDK to avoid double provider registration (ISI-996) ([f1999a5](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/f1999a5c8f702f2bb1a978847ca9fe6a7fab1009))
* **otel:** detect preloaded SDK to avoid double provider registration (ISI-996) ([0275ca1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/0275ca11caadbe56969cb095a63ce05900dec3b1))
* **otel:** filter non-string entries from gen_ai.response.finish_reasons (ISI-993) ([3a29e55](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3a29e553a1b0a350ace9970bf1eb0c42d49b2369))
* **otel:** harden preloaded SDK detection + add unit tests (ISI-1002) ([9871673](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/9871673c03dd4a1c754a73940f73b39014f4090f))
* **otel:** harden preloaded SDK detection + unit tests (ISI-1002) ([e87598a](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/e87598ab1f39ed35090574e9a740df69febb3d7c))
* populate llm.call span tokens when provider skips llm_output ([38c4921](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/38c4921b6c68d91326eb7c399138e258b604dd6a))
* populate llm.call span tokens when provider skips llm_output ([b615b52](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b615b52c2bf108dc2b23aedbbb69699907feb7ea))
* preserve TracerProvider across config hot-reload ([ab05268](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/ab05268ba2545a41e21eac4a6445625d6a7c2dfc))
* preserve TracerProvider across config hot-reload ([a230809](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a230809273ede14c52f9a2877a4c53f55ca70f08))
* recognize `openclaw completion --write-state` as plugin-mgmt context ([5a6a233](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/5a6a233d5bb38c28bc34a500f0babd363b789cb4))
* remove invalid config block from docs (fixes [#1](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/1)) ([3fe82f7](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3fe82f75c745e415292a9f593359355b47d38849))
* replace broken eslint lint script with tsc --noEmit (ISI-931) ([a22b1db](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a22b1db3d00729875387df9b8e60a4426248dd85))
* require exact plugins subcommand argv ([5aee0c1](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/5aee0c1f8ee2c663991a55fbd5f1db2e6c278420))
* resolve review follow-up typecheck inconsistencies ([3e8f8ce](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3e8f8ced1faf0784540b1ded604cab79a4663926))
* resolveLegacyContext traverses sub-agent links for context resolution ([71804c2](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/71804c2ee14a695f5af9d05c184924e858600f87))
* **security:** close redaction bypasses found in PR [#29](https://github.com/th-m-vogel/openclaw-observability-plugin/issues/29) review (ISI-999) ([af3271e](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/af3271ef5140d4a0d44d662e709912fda3f85f23))
* **telemetry:** prevent double-registration breaking span parent chains ([b0684e9](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/b0684e9caadbf6f5e69b803af9325b0adfd9d19c))
* token attributes & metrics export ([6158df0](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/6158df0083d904ef09033f3c3e60d10b1ed3ea44))
* **token-types:** add cache_read and cache_creation token types for gen_ai.client.token.usage histogram ([8f13e05](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/8f13e054316071739797f1c0f5f15f3f48d9a3a0))
* **trace-context-store:** resolve legacy context merge and safe stale cleanup ([5008e50](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/5008e507358e059ebe1ac641590fd8ffb1d5f2cc))
* use absolute ESM paths for SDK imports ([a56b280](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a56b280226030a67cab31e29bf88440efda59b7b))
* use api.on() for typed hooks + manual LLM SDK instrumentation ([3f9e8fc](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3f9e8fc78f68b79014775c50d018326480057e5d))
* use dynamic import() instead of createRequire() for ESM SDK patching ([a548c4c](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/a548c4c6284a0b33c51b5c3177f2574160274ed6))
* use register() from node:module for IITM ESM hooks ([c8c9c72](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/c8c9c7205e32fe95ec93697f32534d51891816a1))
* W3C trace context propagation for subagent sessions (ISI-1021) ([079d2f4](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/079d2f49ad8451d1c0274fe962a0664872904086))
* W3C trace context propagation for subagent sessions (ISI-1021) ([d02ec10](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d02ec10b9b2badd24540cdeb302c67f9ef8c69da))
* wrap .stream() instead of .create() for Anthropic GenAI spans ([87d25b0](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/87d25b0e0cdc7498302e03994ab7c3a92cc56789))


### Reverts

* **dashboard:** hostname is openclaw, not clawdbot ([3f46c1d](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/3f46c1d2cb7ff8204683edca839cec6a962726e8))
* **diagnostics:** remove debug logging and fallback paths ([d1266e5](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/d1266e58c1965bf1eab846d866129521095314ec))


### Miscellaneous Chores

* release 0.5.0 (ISI-992 + ISI-1004) ([48d9514](https://github.com/th-m-vogel/openclaw-observability-plugin/commit/48d9514033316f5b4582ad6833926ebba39eb2aa))

## [0.9.2](https://github.com/th-m-vogel/openclaw-observability-plugin/compare/v0.9.1...v0.9.2) (2026-10-02)

Fork-maintained release (`th-m-vogel/openclaw-observability-plugin`) — upstream has had no maintainer activity since 2026-07-20.

### Bug Fixes

* **otel-logs:** stop double-converting log record timestamps to nanoseconds — fixes log records landing ~57 million years in the future and being silently dropped by timestamp-validating backends
* recognize `openclaw completion --write-state` as plugin-mgmt context — fixes `openclaw completion`/`doctor`/`update` hanging indefinitely
* guard against undefined unhandled rejections crashing the gateway on OpenClaw 9.7 (ISI-9700) — mitigation; root cause is an OpenClaw core regression and remains open upstream

### Dependencies

* bump `@opentelemetry/resources`, `@opentelemetry/sdk-metrics`, `@opentelemetry/sdk-trace-node` to `2.11.0` (upstream PR #71)

## [0.9.1](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.9.0...v0.9.1) (2026-07-20)


### Bug Fixes

* detect plugin management argv sequence ([fd46dbb](https://github.com/henrikrexed/openclaw-observability-plugin/commit/fd46dbb5e3a687bbb628093147bc99c4ca0f5be1))
* **ISI-1710:** add compiled dist output + runtimeExtensions entry; guard telemetry/hooks/diagnostics init under plugin-mgmt CLI context ([bd65052](https://github.com/henrikrexed/openclaw-observability-plugin/commit/bd650523fb409e617cce4b64c5493f06321fb381))
* **ISI-1710:** gate OTLP log pipeline behind plugin-mgmt guard ([02fb2b3](https://github.com/henrikrexed/openclaw-observability-plugin/commit/02fb2b3f6962c02450c384d6c4cb6eae9d4edfb1))
* **ISI-1710:** npm packaging (compiled dist + runtimeExtensions) + plugin-mgmt lifecycle guard (GH [#68](https://github.com/henrikrexed/openclaw-observability-plugin/issues/68)) ([4198048](https://github.com/henrikrexed/openclaw-observability-plugin/commit/4198048ea123e23981f7200ad02edeb2e3c39c6d))
* require exact plugins subcommand argv ([5aee0c1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/5aee0c1f8ee2c663991a55fbd5f1db2e6c278420))

## [0.9.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.8.0...v0.9.0) (2026-07-08)


### Features

* **diagnostics:** add memory.sample + memory.pressure event support ([c30a2e8](https://github.com/henrikrexed/openclaw-observability-plugin/commit/c30a2e8a70f726a633ebb29fe4cbf9cec13a9629))
* **diagnostics:** memory.sample + memory.pressure event support ([bf52daf](https://github.com/henrikrexed/openclaw-observability-plugin/commit/bf52daff8486c094bd0b165cb5f253e782b797d1))


### Bug Fixes

* **hooks:** move DIAG agent-turn verbose context dump from info to debug level ([30e8fa7](https://github.com/henrikrexed/openclaw-observability-plugin/commit/30e8fa752e8016a3aa78bcee451bc6b3e966e837))
* **ISI-1653:** re-parent lifecycle spans into the request/session trace ([#67](https://github.com/henrikrexed/openclaw-observability-plugin/issues/67)) ([e4c1245](https://github.com/henrikrexed/openclaw-observability-plugin/commit/e4c12458f6a7ace0c1696cea4e4b7023974cfe64))

## [Unreleased]

Merged in code review but not yet in a tagged release. Additive — no keys removed or renamed. The plugin-domain attribute schema (`openclaw.schema.version`) advances to `1.5.0`.

### Features

* **ISI-1629:** tool-span enrichment — `openclaw.tool.kind`, `openclaw.tool.input_kind`, and bounded/redacted `openclaw.tool.derived_paths`, read from the already-subscribed `before_tool_call` hook (tool attribution + file blast-radius analysis)

### Bug Fixes

* **ISI-1653:** lifecycle event spans (`openclaw.message.sent`, `openclaw.cron.changed`, `openclaw.dispatch.prepare`) no longer orphan into their own single-span traces. A shared `resolveLifecycleParentContext` walks all store tiers (active → legacy → retained-recent-request → session → gateway) so these spans nest into the request/session trace they belong to, collapsing the previous "1 request → 3-4 traces" fan-out into one trace. A trailing `message_sent` that fires *after* `agent_end` tears down the live context now re-attaches via a bounded, TTL'd (60s) retained request context. The resolved anchor is stamped on each span as `openclaw.trace.parent_source` for diagnosability.

## [0.8.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.7.0...v0.8.0) (2026-07-08)


### Features

* **ISI-1605:** gen_ai content semconv keys for Dynatrace AI Observability ([e5a6ecf](https://github.com/henrikrexed/openclaw-observability-plugin/commit/e5a6ecf8903d7f1a92761201a9f37443d882b2bb))
* **ISI-1627:** subagent_spawned migration + end-to-end trace propagation ([0bda813](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0bda813d3f3c162b03b32657835bdcbd1ce6b216))
* **ISI-1628:** compaction spans + metrics (before/after_compaction) ([6684ad4](https://github.com/henrikrexed/openclaw-observability-plugin/commit/6684ad4c4cfe79f10caedae644abfa3b2090cfba))


### Bug Fixes

* **ISI-1627:** dedupe subagent spawn span when parent has no session context ([953f1ad](https://github.com/henrikrexed/openclaw-observability-plugin/commit/953f1ad5bf66ca7245da8ab984c95ab90a5f2815))

## [0.7.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.6.1...v0.7.0) (2026-06-17)


### Features

* **ISI-1318:** bounded redacted error_preview on failed tool spans, gated by the new `captureContent.toolErrorMessages` flag ([5874839](https://github.com/henrikrexed/openclaw-observability-plugin/commit/58748393b715abd968fe90a135d650ebdf53bd34))

## [0.6.1](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.6.0...v0.6.1) (2026-06-03)


### Bug Fixes

* **diagnostics:** portable internal diagnostic events loader ([0356fbb](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0356fbbe6acc2959d2adbff32a358f9221347332))
* **diagnostics:** portable internal diagnostic events loader ([86f5d04](https://github.com/henrikrexed/openclaw-observability-plugin/commit/86f5d045f938b5c81ef65200fb746babc358eae6))
* **diagnostics:** portable internal diagnostic events loader ([8b40961](https://github.com/henrikrexed/openclaw-observability-plugin/commit/8b40961b49a4a0403cc21909d7301df2d228ed17))
* preserve TracerProvider across config hot-reload ([ab05268](https://github.com/henrikrexed/openclaw-observability-plugin/commit/ab05268ba2545a41e21eac4a6445625d6a7c2dfc))
* preserve TracerProvider across config hot-reload ([a230809](https://github.com/henrikrexed/openclaw-observability-plugin/commit/a230809273ede14c52f9a2877a4c53f55ca70f08))

## [0.6.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.5.0...v0.6.0) (2026-05-13)


### Features

* **dashboard:** add plugin-only dashboard using collected metrics/spans/logs ([b544fa0](https://github.com/henrikrexed/openclaw-observability-plugin/commit/b544fa054df082a270ec002804dabc3af7bf8392))


### Bug Fixes

* **dashboard:** add default:0 for cache token types to handle missing data ([0407203](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0407203166c9d1f19b310ff4339afd877cc92afa))
* **dashboard:** correct hostname filter from openclaw to clawdbot ([c0eee30](https://github.com/henrikrexed/openclaw-observability-plugin/commit/c0eee30e83ba31c313d9f6ce9923c27b27e4757a))
* **dashboard:** remove cache token types until cache usage occurs ([3661c18](https://github.com/henrikrexed/openclaw-observability-plugin/commit/3661c189666fad11cf572f61b72742ccbed8a0fd))
* **dashboard:** use system.cpu.utilization instead of manual calculation ([0480930](https://github.com/henrikrexed/openclaw-observability-plugin/commit/04809303dd53caa9a198b622052df25bbfb822ba))
* **diagnostics:** add debug logging for all diagnostic events ([e2b53f7](https://github.com/henrikrexed/openclaw-observability-plugin/commit/e2b53f72c1619791eb191709c915fc6de6467843))
* **diagnostics:** add info-level logging for liveness warnings ([659e5e7](https://github.com/henrikrexed/openclaw-observability-plugin/commit/659e5e7f621409219b32ed43ddf67153f1506348))
* **diagnostics:** add logging to verify onDiagnosticEvent is loaded ([c7863da](https://github.com/henrikrexed/openclaw-observability-plugin/commit/c7863daa8402c8ce56048c49e6511969782073ea))
* **diagnostics:** prefer internal diagnostic events over SDK wrapper ([af2a5c5](https://github.com/henrikrexed/openclaw-observability-plugin/commit/af2a5c526e15651e164ad4d582fefff3798b83d2))
* **diagnostics:** remove info-level logging that was causing log spam ([7cf1474](https://github.com/henrikrexed/openclaw-observability-plugin/commit/7cf147414270464136a7da305a96cd7bd71b0229))
* **diagnostics:** try internal diagnostic events module as fallback ([0605f4f](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0605f4fc82616192147eabc8a7ea3559d25d0e00))
* **diagnostics:** try multiple paths to load diagnostic events module ([dd728fc](https://github.com/henrikrexed/openclaw-observability-plugin/commit/dd728fcd830551d8381aa8bebdfa922825bc3c63))
* **diagnostics:** use absolute path for internal diagnostic events module ([918d800](https://github.com/henrikrexed/openclaw-observability-plugin/commit/918d800b10eadf80b70f222a4dec960c652a2f56))
* **diagnostics:** wire gateway health metrics from diagnostic events ([d0cbbb8](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d0cbbb8a57967ceecb81eea9dc23db5bf8f71e8c))
* **hooks:** add debug logging for trace context store ([841fe60](https://github.com/henrikrexed/openclaw-observability-plugin/commit/841fe60dfde3c8454519872f1264f3968f338ab0))
* **hooks:** add error logging to message_received hook ([6a7a822](https://github.com/henrikrexed/openclaw-observability-plugin/commit/6a7a82214fc0332cfac0666b93911738f621ba29))
* **hooks:** persist TraceContextStore across plugin reloads ([d23fe92](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d23fe92cbb9430859a1937f363a08b4b58a4c331))
* **hooks:** remove duplicate sessionKey declaration ([20cea91](https://github.com/henrikrexed/openclaw-observability-plugin/commit/20cea9173f9c164f285498b979f11f05288f8af8))
* **index:** register diagnostics listener at register() time, not start() ([0c567c7](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0c567c780269125a037cdd2cd0b19ec526c5411d))
* **telemetry:** prevent double-registration breaking span parent chains ([b0684e9](https://github.com/henrikrexed/openclaw-observability-plugin/commit/b0684e9caadbf6f5e69b803af9325b0adfd9d19c))
* **token-types:** add cache_read and cache_creation token types for gen_ai.client.token.usage histogram ([8f13e05](https://github.com/henrikrexed/openclaw-observability-plugin/commit/8f13e054316071739797f1c0f5f15f3f48d9a3a0))


### Reverts

* **dashboard:** hostname is openclaw, not clawdbot ([3f46c1d](https://github.com/henrikrexed/openclaw-observability-plugin/commit/3f46c1d2cb7ff8204683edca839cec6a962726e8))
* **diagnostics:** remove debug logging and fallback paths ([d1266e5](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d1266e58c1965bf1eab846d866129521095314ec))

## [0.5.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.4.1...v0.5.0) (2026-05-12)


### Features

* **ISI-1017:** add queue and session state metrics ([d8ac76f](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d8ac76f503ffca56f3ecd0d9604014d18576cbff))
* **ISI-1017:** add queue and session state metrics ([7ca1d20](https://github.com/henrikrexed/openclaw-observability-plugin/commit/7ca1d2006b7e6a7817e98f5df364c7696e3a4c49))
* **ISI-1017:** add queue and session state metrics ([1814f3a](https://github.com/henrikrexed/openclaw-observability-plugin/commit/1814f3ac3eaebf6be21b55d4156b708724d527aa))
* **ISI-1018:** add context layer and skill usage tracking ([473833c](https://github.com/henrikrexed/openclaw-observability-plugin/commit/473833c9bc4faf403dcbb5945da21588dbc270bf))
* **ISI-1018:** add context layer and skill usage tracking ([2410d66](https://github.com/henrikrexed/openclaw-observability-plugin/commit/2410d662da488845def3f1f59b31c4cbbd7efe38))
* **ISI-1019:** add subagent deep tracing enhancements ([cf0bf88](https://github.com/henrikrexed/openclaw-observability-plugin/commit/cf0bf88c480f85897a3e4d76463cb213435aef9b))
* **ISI-1019:** add subagent deep tracing enhancements ([a8706f6](https://github.com/henrikrexed/openclaw-observability-plugin/commit/a8706f6cddc80b595a32ecccf5fe232fb1cc740c))
* **ISI-1020:** add webhook observability ([2f91324](https://github.com/henrikrexed/openclaw-observability-plugin/commit/2f9132442a20b0c15d5babeb732e3711c519f828))
* **ISI-1020:** add webhook observability ([b6d48a2](https://github.com/henrikrexed/openclaw-observability-plugin/commit/b6d48a2bbae52b7884457bca88af272aa03205ec))


### Bug Fixes

* guard context utilization against zero context limit ([b3db23b](https://github.com/henrikrexed/openclaw-observability-plugin/commit/b3db23b75dcb29c6a3022450a487bf28f11d7867))

## [0.4.1](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.4.0...v0.4.1) (2026-05-12)


### Bug Fixes

* W3C trace context propagation for subagent sessions (ISI-1021) ([079d2f4](https://github.com/henrikrexed/openclaw-observability-plugin/commit/079d2f49ad8451d1c0274fe962a0664872904086))
* W3C trace context propagation for subagent sessions (ISI-1021) ([d02ec10](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d02ec10b9b2badd24540cdeb302c67f9ef8c69da))

## [0.4.0](https://github.com/henrikrexed/openclaw-observability-plugin/compare/v0.3.0...v0.4.0) (2026-05-12)


### Features

* **dashboard:** align repo OpenClaw overview to V3 spans (ISI-1007) ([c250fe1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/c250fe1a11715dd5875cc9a861b62070e89cc57e))
* **dashboard:** align repo OpenClaw overview to V3 spans (ISI-1007) ([511201f](https://github.com/henrikrexed/openclaw-observability-plugin/commit/511201f98ed7cb4659e003109150deff8ac3f0cd))
* **otel:** configurable trace sampling rate (ISI-998) ([32afcdf](https://github.com/henrikrexed/openclaw-observability-plugin/commit/32afcdf491a66f16cad1cf3c26adada0e1fe8d44))
* **otel:** configurable trace sampling rate (ISI-998) ([acd6a7c](https://github.com/henrikrexed/openclaw-observability-plugin/commit/acd6a7ca0a736faa97c1f9c074a1c3cc9ebe7680))
* **otel:** granular ContentCapturePolicy for span content capture (ISI-1000) ([592920d](https://github.com/henrikrexed/openclaw-observability-plugin/commit/592920d565c40c7c19526ceb27513e8ac4a33b8e))
* **otel:** granular ContentCapturePolicy for span content capture (ISI-1000) ([aa207b1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/aa207b1af2b22bdd496195da3904691035449130))
* **otel:** W3C trace context propagation (ISI-1001) ([53695b1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/53695b19587653c2c2783c295611aabd9f655ca9))
* **otel:** W3C trace context propagation for distributed tracing (ISI-1001) ([95e2178](https://github.com/henrikrexed/openclaw-observability-plugin/commit/95e217888c8ba09af5ce03bf85553be4381161b0))
* **otel:** wire OTLP log export pipeline into plugin lifecycle (ISI-997) ([d26944c](https://github.com/henrikrexed/openclaw-observability-plugin/commit/d26944c43aea667a5ab0546d538afe7916c08d43))
* **otel:** wire OTLP log export pipeline into plugin lifecycle (ISI-997) ([e46a236](https://github.com/henrikrexed/openclaw-observability-plugin/commit/e46a2367623581f1961db718bfcf5abf410c148c))
* publish to npm + add release-please/publish workflows (ISI-947) ([20a9f62](https://github.com/henrikrexed/openclaw-observability-plugin/commit/20a9f62aba2f478c9df17cf06cc5524c6226b386))
* publish to npm + add release-please/publish workflows (ISI-947) ([2ba08c1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/2ba08c1251b21675c5feb54eaca69c24e4b91cbe))
* **security:** redact sensitive values from trace attributes (ISI-999) ([2013060](https://github.com/henrikrexed/openclaw-observability-plugin/commit/2013060fee00c0e2acdd7e1587d6db0df8bd4e43))
* **security:** redact sensitive values from trace attributes (ISI-999) ([675311a](https://github.com/henrikrexed/openclaw-observability-plugin/commit/675311af452afa3727a43075db885949e74525bc))


### Bug Fixes

* **otel:** address PR [#30](https://github.com/henrikrexed/openclaw-observability-plugin/issues/30) review findings (ISI-1000) ([48eb16d](https://github.com/henrikrexed/openclaw-observability-plugin/commit/48eb16dd332d2902aa0891cf1842f6976ebd8c38))
* **otel:** apply code-review patches to OTLP log bridge (ISI-997) ([31a885d](https://github.com/henrikrexed/openclaw-observability-plugin/commit/31a885d4fd9e3eb853ecca97c1875490e046824b))
* **otel:** bring GenAI semconv emission back to registry compliance (ISI-993) ([53eda2a](https://github.com/henrikrexed/openclaw-observability-plugin/commit/53eda2ad14034a07e9dba6f87a5967eb304501a9))
* **otel:** bring GenAI semconv emission back to registry compliance (ISI-993) ([a825927](https://github.com/henrikrexed/openclaw-observability-plugin/commit/a825927635164c021ef79e3e0dc48a448811536b))
* **otel:** close M1+M2 redaction gaps in content capture (ISI-1000) ([28dd485](https://github.com/henrikrexed/openclaw-observability-plugin/commit/28dd48575b986c8842572c5e922948371ac59342))
* **otel:** detect preloaded SDK to avoid double provider registration (ISI-996) ([f1999a5](https://github.com/henrikrexed/openclaw-observability-plugin/commit/f1999a5c8f702f2bb1a978847ca9fe6a7fab1009))
* **otel:** detect preloaded SDK to avoid double provider registration (ISI-996) ([0275ca1](https://github.com/henrikrexed/openclaw-observability-plugin/commit/0275ca11caadbe56969cb095a63ce05900dec3b1))
* **otel:** filter non-string entries from gen_ai.response.finish_reasons (ISI-993) ([3a29e55](https://github.com/henrikrexed/openclaw-observability-plugin/commit/3a29e553a1b0a350ace9970bf1eb0c42d49b2369))
* **otel:** harden preloaded SDK detection + add unit tests (ISI-1002) ([9871673](https://github.com/henrikrexed/openclaw-observability-plugin/commit/9871673c03dd4a1c754a73940f73b39014f4090f))
* **otel:** harden preloaded SDK detection + unit tests (ISI-1002) ([e87598a](https://github.com/henrikrexed/openclaw-observability-plugin/commit/e87598ab1f39ed35090574e9a740df69febb3d7c))
* **security:** close redaction bypasses found in PR [#29](https://github.com/henrikrexed/openclaw-observability-plugin/issues/29) review (ISI-999) ([af3271e](https://github.com/henrikrexed/openclaw-observability-plugin/commit/af3271ef5140d4a0d44d662e709912fda3f85f23))

## [Unreleased]

### Removed

- **Legacy OTel semconv 2026-04 attributes — dual-emit window closed (ISI-1004).**
  Schema version bumped to `1.3.0` (resource attribute
  `openclaw.schema.version`); plugin version bumped to `0.5.0`. The
  deprecated keys dual-emitted in `1.2.0` (ISI-994) are no longer
  emitted on spans or metrics:

  | Removed (1.3.0)                       | Stable replacement (already shipped in 1.2.0)                            |
  | ------------------------------------- | ------------------------------------------------------------------------ |
  | `gen_ai.system`                       | `gen_ai.provider.name`                                                   |
  | `code.function` + `code.namespace`    | `code.function.name` + `code.file.path`                                  |
  | `gen_ai.usage.cache_read_tokens`      | `gen_ai.usage.cache_read.input_tokens`                                   |
  | `gen_ai.usage.cache_write_tokens`     | `gen_ai.usage.cache_creation.input_tokens`                               |
  | `gen_ai.usage.total_tokens`           | none — consumers compute `input + output` (per `1.2.0` deprecation note) |

  Affected emit sites: `llm_input`, `llm_output`, `model_call_started`,
  `model_call_ended`, both `agent_end` safety nets in `src/hooks.ts`; the
  `model.usage` metric attribute set and `enrichSpanWithUsage` in
  `src/diagnostics.ts`. Constants exported from `src/semconv.ts` for the
  removed keys (`GEN_AI_SYSTEM`, `CODE_FUNCTION`, `CODE_NAMESPACE`,
  `GEN_AI_USAGE_CACHE_READ_TOKENS`, `GEN_AI_USAGE_CACHE_WRITE_TOKENS`,
  `GEN_AI_USAGE_TOTAL_TOKENS`) are also deleted. The
  `tests/hooks.test.ts` "ISI-994 dual-emit" describe block is replaced by
  an "ISI-1004 legacy removal" block that pins the inverse assertions, so
  any regression that re-introduces a legacy key fails the suite.

  **Consumer action:** dashboards, alerts, and queries must switch to the
  stable keys before upgrading to plugin `0.5.0` / schema `1.3.0`. See
  [ISI-994](./docs/architecture.md#deprecated-attributes--dual-emit-window-schema-12x)
  for the migration history.

### Added

- **Resource identity hygiene (ISI-995).** The trace, metric, and log
  Resources now emit a real `service.version` resolved from
  `openclaw.plugin.json` (replacing the legacy hard-coded `"0.1.0"`
  placeholder so version-comparison dashboards see actual plugin
  releases) and an OTel semconv `schema_url` pinned to the installed
  `@opentelemetry/semantic-conventions` version (currently
  `https://opentelemetry.io/schemas/1.39.0`). The instrumentation-scope
  version on every span / metric / LogRecord now matches the plugin
  version too. Plugin version lives in a new `src/version.ts` module.
- **`user.id` mirror on `openclaw.session` span (ISI-995).** The stable
  OTel general attribute `user.id` is dual-emitted alongside the
  existing `openclaw.session.user_id` so registry-keyed dashboards can
  correlate sessions on a standard attribute. `openclaw.session.user_id`
  is retained for backwards compatibility — this is a dual-emit, not a
  rename.
- **Log-attribute dedup (ISI-995).** OTLP log records now emit
  OTel-stable `code.function.name`, `code.file.path`, and
  `code.line.number` for the emit site, replacing the older
  `openclaw.log.function`, `openclaw.log.file`, and `openclaw.log.line`
  triplet (which duplicated the same semantics in a non-portable
  namespace and confused log-pipeline filters keyed on `code.*`). The
  pipeline no longer emits `openclaw.log.trace_id`, `openclaw.log.span_id`,
  or `openclaw.log.trace_flags` either — those fields are already on the
  OTLP LogRecord via the active context the pipeline forwards into
  `emit()`, so the duplicate attribute lines were silent double-records.
- **OTel GenAI / code semconv 2026-04 alignment — dual-emit window (ISI-994).**
  Schema version bumped to `1.2.0` (resource attribute
  `openclaw.schema.version`). Spans and metrics that previously emitted
  deprecated attribute keys now also emit the stable replacements alongside
  the legacy ones for one minor release:
  - `gen_ai.system` → dual-emit with `gen_ai.provider.name` (LLM client span
    from `llm_input`, agent-turn enrichment in
    `enrichSpanWithUsage`, and the `model.usage` metric attribute set in
    `diagnostics.ts`). `model_call_started` already dual-emitted.
  - `code.function` + `code.namespace` → dual-emit with
    `code.function.name` (fully-qualified `${namespace}.${function}`) plus
    `code.file.path` at every hook-span emit site. Centralised in the new
    `codeAttrs(funcName)` helper in `src/hooks.ts`. Per-site source line
    numbers are intentionally not emitted (they would rot on every edit);
    consumers needing precise emit locations should rely on the function
    name + file path pair.
  - `gen_ai.usage.cache_read_tokens` / `gen_ai.usage.cache_write_tokens`
    → dual-emit with the stable `gen_ai.usage.cache_read.input_tokens` /
    `gen_ai.usage.cache_creation.input_tokens`. Migrated call sites:
    `llm_output`, both `agent_end` safety nets in `src/hooks.ts`, and
    `enrichSpanWithUsage` in `src/diagnostics.ts`.
  - `gen_ai.usage.total_tokens` is **kept** but marked `@deprecated` in
    `src/semconv.ts` — consumers should compute `input + output` going
    forward.

  **Planned removal:** schema `1.3.0` / plugin `0.5.0`. The deprecation
  window is one minor release; the follow-up removal task is filed as
  ISI-1004 (a child of the ISI-992 epic).
  See [`docs/architecture.md#deprecated-attributes--dual-emit-window-schema-12x`](./docs/architecture.md#deprecated-attributes--dual-emit-window-schema-12x)
  for the full migration table and the consumer-side update checklist.
- **Granular content capture policy (ISI-1000).** The `captureContent`
  plugin option now accepts a `ContentCapturePolicy` object with five
  per-category flags (`inputMessages`, `outputMessages`, `toolInputs`,
  `toolOutputs`, `systemPrompt`) in addition to the legacy single boolean.
  Each flag gates one or more `openclaw.content.*` span attributes (capped
  at 8192 UTF-16 code units per value, with surrogate-pair-safe truncation).
  The legacy boolean still works — `true` enables all five flags, `false`
  disables them. Traceloop's `traceContent` is derived from
  `inputMessages || outputMessages || systemPrompt`; because Traceloop has a
  single boolean, enabling any one of those three causes its LLM-client spans
  to record both prompt and completion content (see
  [`docs/security/privacy.md`](./docs/security/privacy.md)).
- New env var `OPENCLAW_OTEL_CONTENT_POLICY` (JSON) bridges the policy to
  the ESM preload. Takes precedence over the legacy
  `OPENCLAW_OTEL_CAPTURE_CONTENT` when both are set.
- **Configurable trace sampling rate (ISI-998).** New `sampleRate` option
  (0.0–1.0) in `diagnostics.otel`. When set, the plugin wires a
  `ParentBasedSampler` around a `TraceIdRatioBasedSampler` so root spans
  make a deterministic, trace-id-based sampling decision and child spans
  inherit it — keeping distributed traces coherent under head-based
  sampling. Invalid values (out of range, `NaN`, non-numeric) are ignored
  and the SDK default (`parentbased_always_on`) is used. Documented in
  `docs/configuration.md#trace-sampling`.

### Changed

- **OpenClaw attribute schema bumped to `1.1.0` (ISI-993).** Three call sites
  that emitted invalid OpenTelemetry GenAI semantic-convention data are now
  registry-compliant:
  - `gen_ai.response.finish_reasons` now emits as `string[]` (it was previously
    a comma-joined string). Consumers reading the attribute should expect an
    array on captured spans.
  - The invalid `gen_ai.operation.name = "cron_executed"` attribute is no
    longer set on `openclaw.cron.exec` spans; the registry only allows the
    nine standard values (`chat`, `create_agent`, `embeddings`, `execute_tool`,
    `generate_content`, `invoke_agent`, `invoke_workflow`, `retrieval`,
    `text_completion`). Cron context remains available via `openclaw.cron.*`.

### Fixed

- **`gen_ai.response.finish_reasons` array hardening (ISI-993).** Non-string
  entries (`null`, `undefined`, numbers, empty strings) are now filtered out
  of the array before the attribute is set. If the array contains no valid
  strings after filtering, the attribute is omitted entirely. This prevents
  malformed upstream events from emitting non-spec data via the unchecked
  TypeScript cast that landed in the initial Story 1 fix.
- **Boundary-straddle redaction leak in content capture (ISI-1000).**
  `captureContentAttribute` and `setToolInputPreview` now redact BEFORE
  truncating. The previous order let a secret straddling the 8192-char
  (or 1000-char preview) cap get sliced below the redaction regex's
  minimum-match length, leaving a plaintext token prefix in the captured
  span attribute. Verified with a bearer-token regression test driving
  the boundary.
- **Synthetic tool span SECURITY warn log redaction (ISI-1000).** The
  third `[otel] SECURITY: ...` warn callsite (the `tool_result_persist`
  no-active-tool-span fallback) was missing the `redactSensitiveText`
  wrap that the other two security warns already had. With ISI-997's
  OTLP log bridge on `main`, that callsite could ship credentials
  embedded in user-supplied paths/commands to the backend logs. All
  three callsites now share the redacted shape.

### Breaking

- **Tool-approval attributes moved out of the reserved `gen_ai.*` namespace
  (ISI-993).** The OTel registry reserves `gen_ai.*` for standardised
  attributes; the plugin's custom approval keys have been renamed to the
  plugin-domain namespace:
  - `gen_ai.tool.approval.requested` → `openclaw.tool.approval.requested`
  - `gen_ai.tool.approval.resolution` → `openclaw.tool.approval.resolution`
  - `gen_ai.tool.approval.duration_ms` → `openclaw.tool.approval.duration_ms`

  Dashboards or alert rules filtering on the old `gen_ai.tool.approval.*` keys
  must be updated. `OPENCLAW_SCHEMA_VERSION` is bumped from `1.0.0` to `1.1.0`
  so consumers can detect the rename.

## [0.3.1] — 2026-05-10

### Added

- **npm publication (ISI-947 / GH#21).** Plugin is now published on npm as
  `@henrikrexed/openclaw-otel-observability`, enabling installation via
  `openclaw-operator`'s `OpenClawInstance.spec.plugins`.
- **Release automation.** `release-please` workflow opens versioning PRs from
  conventional-commit history; merging a release PR creates a GitHub Release,
  which triggers the `publish-npm` workflow with `--provenance --access public`.
- `package.json` now declares a `files` allowlist (source `.ts`, preload mjs,
  manifest, README, LICENSE, CHANGELOG) so the published tarball excludes
  tests, dashboards, docs site, and dev tooling.

### Changed

- Package renamed from `@openclaw/otel-observability` to
  `@henrikrexed/openclaw-otel-observability`. The `@openclaw` scope is owned
  by an unrelated maintainer, so the plugin uses the author's personal scope
  (mirroring `@larksuite/openclaw-lark` and `@tencent-weixin/openclaw-weixin`).
- README install guide leads with `npm install`; the `git clone` path is
  retained as a "local development" fallback.

### Fixed

- **Document the `hooks.allowConversationAccess: true` requirement (ISI-945,
  github issue [#20](https://github.com/henrikrexed/openclaw-observability-plugin/issues/20)).**
  OpenClaw 2026.4.23 introduced a typed-hook policy gate: non-bundled
  (path-loaded) plugins must explicitly opt in to the conversation hooks
  (`before_model_resolve`, `before_agent_reply`, `llm_input`, `llm_output`,
  `before_agent_finalize`, `agent_end`, `before_agent_run`) by setting
  `plugins.entries.<plugin-id>.hooks.allowConversationAccess: true` on their
  entry. Without it the runtime silently drops those registrations — the
  plugin's `[otel] Registered ... hook (via api.on)` banners still print but
  the handlers never fire, so no `openclaw.request` / `openclaw.agent.turn`
  spans reach the backend even though the metric heartbeat keeps emitting.
  README install snippets, `docs/getting-started.md`, and the
  README troubleshooting section now document the requirement and the
  `pluginDiagnostics` block warning to look for.

## [0.3.0] — 2026-05-10

### Added

- **Log export pipeline (ISI-930).** OTLP log export via `log.record` diagnostic events
  with severity mapping, trace context enrichment, configurable filtering, and logger
  name/function/file/line attributes.
- **Trace context store.** New `TraceContextStore` module for session context propagation
  across spans, including legacy context merge and stale session cleanup.
- **V2 → V3 migration guide** at `docs/migration-v2-to-v3.md` covering breaking changes,
  new features, dashboard migration, and upgrade steps.
- **Troubleshooting section** in README covering hook registration, plugin loading, and
  trace connectivity issues.

### Fixed

- Align `activeSessions` gauge attributes between `session_start` and `session_end` hooks.
- `resolveLegacyContext` now traverses sub-agent links for correct context resolution.
- Trace context store handles legacy context merge and safe stale cleanup.
- Deduplicated tool input preview logic via `setToolInputPreview` helper.
- Telemetry histogram alias wording clarified.
- Review follow-up typecheck inconsistencies resolved.
- Lint script replaced broken `eslint` reference with `tsc --noEmit`.

### Changed

- README updated with V3 features table, plugin lifecycle documentation, and log pipeline
  configuration reference.
- Architecture docs updated with new trace structure and GenAI semconv attributes table.

## [0.2.0] — 2026-04-23

### Changed

- **Hook migration (ISI-730).** Replaced the legacy `before_agent_start` hook
  registration with the phase-specific hooks introduced in OpenClaw 2026.4.21:
  - `before_model_resolve` — creates the `openclaw.agent.turn` span at the
    earliest point in the agent run. Agent-identity attributes
    (`gen_ai.agent.id`, `gen_ai.conversation.id`, `openclaw.agent.id`,
    `openclaw.session.key`) are set here. `gen_ai.request.model` is
    intentionally omitted because the model has not yet been resolved.
  - `before_prompt_build` — enriches the existing agent turn span with
    `openclaw.prompt.chars` and `openclaw.session.message_count` once the
    session history has been loaded, before the LLM call.

  Existing trace structure (`openclaw.request` → `openclaw.agent.turn` →
  tool spans → `agent_end`) is preserved. All previously-emitted span
  attributes still appear on the agent turn span; two new
  `openclaw.prompt.*` / `openclaw.session.message_count` attributes are
  added as a bonus.

- **`captureContent` is now wired end-to-end to Traceloop LLM-client spans
  (ISI-733).** Setting `captureContent: true` in the plugin config (plus
  `OPENCLAW_OTEL_CAPTURE_CONTENT=true` in the gateway's environment, read by
  `instrumentation/preload.mjs` before Traceloop loads) causes
  `@traceloop/instrumentation-anthropic` and
  `@traceloop/instrumentation-openai` to record prompt and completion text
  as `gen_ai.prompt.*` / `gen_ai.completion.*` span attributes. Previously
  the option was accepted but had no effect on LLM-client spans.
  - Default stays `false` (privacy-first).
  - `captureContent` is a **gateway-launch setting, not hot-reloadable** —
    the preload runs before plugin config is parsed, so the Traceloop
    instrumentations are constructed once at process start. Restart the
    gateway to pick up changes.
  - The plugin logs a warning at `start()` if the config and the preload's
    resolved env-var value disagree.
  - See [docs/security/privacy.md](docs/security/privacy.md) and
    [docs/configuration.md](docs/configuration.md#capturecontent-gateway-launch-setting).
  - Resolves [github issue #15](https://github.com/henrikrexed/openclaw-observability-plugin/issues/15)
    (ISI-733 / ISI-734).

### Removed

- `before_agent_start` hook registration. The plugin no longer listens to
  this legacy hook. If you run this version against OpenClaw &lt; 2026.4.21,
  the agent turn span will not be created. Pin to `0.1.x` if you still
  need the legacy path.

### Added

- `minOpenClawVersion: 2026.4.21` in `openclaw.plugin.json`.
- Regression tests for hook wiring (`tests/hooks.test.ts`).
- `instrumentation/capture-content.mjs` exports `resolveCaptureContent(env)`
  and the `CAPTURE_CONTENT_ENV` constant, consumed by the preload and
  covered by `instrumentation/capture-content.test.mjs` (`npm test`, uses
  `node --test`).
- `docs/security/privacy.md` — new page covering the privacy implications
  of `captureContent`, how to enable it safely, and redaction guidance.

## [0.1.0] — 2026-04-16

Initial public release. See the repository `README.md` and `docs/` tree for
capability documentation.
