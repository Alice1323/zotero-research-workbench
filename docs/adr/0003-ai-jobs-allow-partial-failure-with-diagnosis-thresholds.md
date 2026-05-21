# AI jobs allow partial failure with diagnosis thresholds

v0.3 AI Jobs will continue past individual per-paper failures, retry transient failures twice, and mark unrecoverable per-paper failures as Task Skips. A Job Failure Diagnosis is shown when failures suggest a systemic problem: three failures for jobs under ten tasks, thirty percent failures for jobs with ten or more tasks, five consecutive failures, or any systemic provider, connector, or authentication failure.
