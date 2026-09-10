"use client";

import { Button } from "@/components/portal/button";
import { formControlClasses } from "@/components/portal/form-control";
import { FormField, InlineNotice, SURFACE_CARD } from "@/components/portal/ui";
import { useId, useState } from "react";
import type { MaintenanceWorkflowStatus } from "./types";

export type MaintenanceActionCardProps = {
  workflowStatus: MaintenanceWorkflowStatus;
  actionsDisabled?: boolean;
  onDispatched: (assignee: string) => void | Promise<void>;
  onCompleted: (note: string) => void | Promise<void>;
  onCancelled: (note: string) => void | Promise<void>;
};

export function MaintenanceActionCard({
  workflowStatus,
  actionsDisabled = false,
  onDispatched,
  onCompleted,
  onCancelled,
}: MaintenanceActionCardProps) {
  const assignId = useId();
  const completeId = useId();
  const cancelId = useId();

  const [assignee, setAssignee] = useState("");
  const [completeNote, setCompleteNote] = useState("");
  const [cancelNote, setCancelNote] = useState("");

  const closed = workflowStatus === "completed" || workflowStatus === "cancelled";
  const buttonsLocked = closed || actionsDisabled;

  return (
    <section className={`${SURFACE_CARD} p-4`} aria-labelledby="actions-heading" aria-busy={actionsDisabled}>
      <h2
        id="actions-heading"
        className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle"
      >
        Actions
      </h2>

      {closed ? (
        <InlineNotice className="mt-3">
          {workflowStatus === "completed"
            ? "This request is completed. No further action is required."
            : "This request was cancelled."}
        </InlineNotice>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {workflowStatus === "new" ? (
            <div>
              <p className="text-sm font-semibold text-foreground">Mark as dispatched</p>
              <p className="mt-1 text-sm text-foreground-muted">
                Record that someone is attending (optional assignee name).
              </p>
              <div className="mt-3">
                <FormField htmlFor={assignId} label="Assignee (optional)" helper="Name or company attending.">
                  <input
                    id={assignId}
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    disabled={actionsDisabled}
                    className={formControlClasses({ size: "lg" })}
                  />
                </FormField>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="mt-3"
                disabled={actionsDisabled}
                onClick={() => void onDispatched(assignee.trim())}
              >
                {actionsDisabled ? "Saving…" : "Mark as dispatched"}
              </Button>
            </div>
          ) : (
            <InlineNotice>Dispatched — mark complete when work is finished, or cancel if void.</InlineNotice>
          )}

          {workflowStatus === "dispatched" ? (
            <div>
              <FormField htmlFor={completeId} label="Mark as completed" helper="Completion note (optional).">
                <textarea
                  id={completeId}
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  rows={3}
                  disabled={buttonsLocked}
                  className={formControlClasses({ size: "lg", className: "min-h-[5.5rem]" })}
                />
              </FormField>
              <Button
                variant="primary"
                size="lg"
                className="mt-3"
                disabled={buttonsLocked}
                onClick={() => void onCompleted(completeNote.trim())}
              >
                {actionsDisabled ? "Saving…" : "Mark as completed"}
              </Button>
            </div>
          ) : workflowStatus === "new" ? (
            <p className="text-sm text-foreground-muted">Complete is available after dispatch.</p>
          ) : null}

          <div className="border-t border-border pt-6">
            <FormField htmlFor={cancelId} label="Cancel request" helper="Reason (optional).">
              <textarea
                id={cancelId}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                rows={2}
                disabled={buttonsLocked}
                className={formControlClasses({ size: "lg" })}
              />
            </FormField>
            <Button
              variant="primary"
              size="lg"
              className="mt-3"
              disabled={buttonsLocked}
              onClick={() => void onCancelled(cancelNote.trim())}
            >
              {actionsDisabled ? "Saving…" : "Cancel request"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
