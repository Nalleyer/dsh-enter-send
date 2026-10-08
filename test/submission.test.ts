/**
 * Submission-policy tests: the browser-local preference store and its durable
 * write path over the Host configuration form.
 *
 * The fake form stands in for `ConfigForm<EnterSendSettings>`: a sync
 * snapshot, subscriber fan-out, and a recorded `set` queue.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { EnterSendPolicy } from "../src/client/submission.ts";
import type { EnterSendSettings, SendMode } from "../src/submission-settings.ts";

/**
 * Client-side sync state of one settings section, mirrored locally so this
 * test needs no runtime dependency on the settings package.
 */
interface FormSnapshot<T> {
  status: "loading" | "ready" | "unavailable";
  value: T | undefined;
  revision: number | undefined;
}

/** Minimal configuration-form stand-in for one profile entry. */
class FakeForm {
  snapshot: FormSnapshot<EnterSendSettings>;
  writes: Array<{ field: string; value: unknown }> = [];
  private listeners = new Set<() => void>();

  constructor(value: EnterSendSettings | undefined) {
    this.snapshot = {
      status: value === undefined ? "loading" : "ready",
      value,
      revision: 1,
    };
  }

  getSnapshot(): FormSnapshot<EnterSendSettings> {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async set(field: string, value: unknown): Promise<boolean> {
    this.writes.push({ field, value });
    return true;
  }

  async unset(): Promise<boolean> {
    return true;
  }

  async mutate(): Promise<boolean> {
    return true;
  }

  /** Host accepted a new durable section: publish it to subscribers. */
  publish(value: EnterSendSettings): void {
    const revision = this.snapshot.revision ?? 0;
    this.snapshot = { ...this.snapshot, status: "ready", value, revision: revision + 1 };
    for (const listener of [...this.listeners]) listener();
  }
}

/** The policy only reads the form face above; the cast keeps the fake small. */
function policyWith(form: FakeForm | undefined): EnterSendPolicy {
  return new EnterSendPolicy(form as never);
}

test("without a Host form the mode stays the browser-local default", () => {
  const policy = policyWith(undefined);
  assert.equal(policy.mode.getSnapshot(), "enter");
  policy.setMode("ctrl-enter");
  assert.equal(policy.mode.getSnapshot(), "ctrl-enter");
  policy.dispose();
});

test("the policy adopts a durable mode from the Host form without writing it back", () => {
  const form = new FakeForm({ mode: "ctrl-enter" });
  const policy = policyWith(form);
  assert.equal(policy.mode.getSnapshot(), "ctrl-enter");
  assert.deepEqual(form.writes, [], "adoption must not write back");
  policy.dispose();
});

test("a later Host section replaces the local mode", () => {
  const form = new FakeForm(undefined);
  const policy = policyWith(form);
  assert.equal(policy.mode.getSnapshot(), "enter");
  form.publish({ mode: "ctrl-enter" });
  assert.equal(policy.mode.getSnapshot(), "ctrl-enter");
  form.publish({ mode: "enter" });
  assert.equal(policy.mode.getSnapshot(), "enter");
  policy.dispose();
});

test("setMode publishes locally first and then queues the durable write", () => {
  const form = new FakeForm({ mode: "enter" });
  const policy = policyWith(form);
  policy.setMode("ctrl-enter");
  assert.equal(policy.mode.getSnapshot(), "ctrl-enter");
  assert.deepEqual(form.writes, [{ field: "mode", value: "ctrl-enter" }]);
  policy.dispose();
});

test("setMode is a no-op for the mode already in effect", () => {
  const form = new FakeForm({ mode: "enter" });
  const policy = policyWith(form);
  policy.setMode("enter");
  assert.deepEqual(form.writes, []);
  policy.dispose();
});

test("dispose releases the Host subscription", () => {
  const form = new FakeForm({ mode: "enter" });
  const policy = policyWith(form);
  policy.dispose();
  form.publish({ mode: "ctrl-enter" });
  assert.equal(policy.mode.getSnapshot(), "enter", "a disposed policy must stop adopting");
});

test("every declared mode round-trips through the vocabulary", () => {
  const modes: SendMode[] = ["enter", "ctrl-enter"];
  for (const mode of modes) {
    const form = new FakeForm({ mode });
    const policy = policyWith(form);
    assert.equal(policy.mode.getSnapshot(), mode);
    policy.dispose();
  }
});
