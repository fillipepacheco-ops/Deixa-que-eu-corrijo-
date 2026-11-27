import { test } from "node:test";
import assert from "node:assert/strict";
import { accessState, blockDate, canUseApp, daysBetween } from "../src/lib/billing/plans";

const T = "2026-11-27";
test("dias entre datas", () => {
  assert.equal(daysBetween("2026-11-27", "2026-12-27"), 30);
  assert.equal(daysBetween("2026-11-27", "2026-11-13"), -14);
});
test("estados de acesso", () => {
  assert.equal(accessState(null, T), "aguardando");
  assert.equal(accessState({ status: "pending", paid_until: null }, T), "aguardando");
  assert.equal(accessState({ status: "suspended", paid_until: "2027-01-01" }, T), "suspenso");
  assert.equal(accessState({ status: "active", paid_until: "2026-12-20" }, T), "em_dia");
  assert.equal(accessState({ status: "active", paid_until: "2026-12-02" }, T), "vencendo");
  assert.equal(accessState({ status: "active", paid_until: "2026-11-27" }, T), "vencendo");
  assert.equal(accessState({ status: "active", paid_until: "2026-11-13" }, T), "atrasado"); // 14 dias: ainda entra
  assert.equal(accessState({ status: "active", paid_until: "2026-11-12" }, T), "bloqueado"); // 15 dias: bloqueia
});
test("quem pode usar e data de bloqueio", () => {
  assert.ok(canUseApp("atrasado"));
  assert.ok(!canUseApp("bloqueado"));
  assert.ok(!canUseApp("aguardando"));
  assert.equal(blockDate("2026-11-30"), "2026-12-14");
});
