"use client";

import { FormField, InlineNotice, PrimaryButton, SURFACE_CARD } from "@/components/portal/ui";
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
      <h2 id="actions-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
              <p className="text-sm font-semibold text-neutral-900">Mark as dispatched</p>
              <p className="mt-1 text-sm text-neutral-600">
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
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm disabled:opacity-60"
                  />
                </FormField>
              </div>
              <PrimaryButton
                type="button"
                className="mt-3"
                disabled={actionsDisabled}
                onClick={() => void onDispatched(assignee.trim())}
              >
                {actionsDisabled ? "Saving…" : "Mark as dispatched"}
              </PrimaryButton>
            </div>
          ) : (
            <InlineNotice>Dispatched — mark complete when work is finished, or cancel if void.</InlineNotice>
          )}

          {workflowStatus === "dispatched" ? (
            <div>
              <p className="text-sm font-semibold text-neutral-900">Mark as completed</p>
              <textarea
                id={completeId}
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                rows={3}
                disabled={buttonsLocked}
                className="mt-3 min-h-[5.5rem] w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm disabled:opacity-60"
              />
              <PrimaryButton
                type="button"
                className="mt-3"
                disabled={buttonsLocked}
                onClick={() => void onCompleted(completeNote.trim())}
              >
                {actionsDisabled ? "Saving…" : "Mark as completed"}
              </PrimaryButton>
            </div>
          ) : workflowStatus === "new" ? (
            <p className="text-sm text-neutral-600">Complete is available after dispatch.</p>
          ) : null}

          <div className="border-t border-neutral-200 pt-6">
            <p className="text-sm font-semibold text-neutral-900">Cancel request</p>
            <textarea
              id={cancelId}
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              rows={2}
              disabled={buttonsLocked}
              className="mt-3 w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-sm disabled:opacity-60"
            />
            <PrimaryButton
              type="button"
              className="mt-3"
              disabled={buttonsLocked}
              onClick={() => void onCancelled(cancelNote.trim())}
            >
              {actionsDisabled ? "Saving…" : "Cancel request"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
