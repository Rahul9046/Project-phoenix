import { useState } from "react";
import { View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  REPORT_REASONS,
  reportNeedsDetails,
  reportReasonKey,
  type ReportReasonCode,
} from "@eraya/i18n";

import { useT } from "@/features/i18n/LocaleProvider";
import {
  blockMember,
  endConnection,
  reportAndBlockMember,
} from "@/features/members/data";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { SelectionCard } from "@/ui/Selection";
import { BottomSheet, ConfirmSheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * The way out.
 *
 * Blocking, reporting and ending a connection, in one component so they appear
 * identically on a profile and in a conversation. Somebody who needs these must
 * find them in the same place every time, and must never have to discover a
 * long-press to get at them.
 *
 * Four decisions built into the behaviour:
 *
 * Reporting blocks as well, and the two are one call. `report_and_block_member`
 * writes both rows or neither, so there is no outcome where somebody has told
 * us they are frightened of a member and that member can still see them.
 *
 * Exactly one reason, from a fixed list shared with the website. A report that
 * claims four things at once is a report nobody can act on first, and a
 * hand-typed reason cannot be counted or triaged at all.
 *
 * The written details are optional for every category except "Something else",
 * which is the one that says nothing by itself.
 *
 * The wording never promises a review. There is no moderation team and no
 * queue, so it says the report is recorded and the person is blocked -- both
 * true -- and nothing about anybody reading it. Afterwards it says both of
 * those things in a panel rather than a toast that slides away: somebody who
 * has just done a difficult thing should be able to read what happened twice.
 */
export function SafetyActions({
  memberId,
  memberName,
  /** Present in a conversation; absent on a profile of someone not connected. */
  connectionId,
  onDone,
  style,
}: {
  memberId: string;
  memberName: string;
  connectionId?: string;
  onDone: () => void;
  style?: ViewStyle;
}) {
  const t = useT();
  const toast = useToast();
  const [sheet, setSheet] = useState<
    "none" | "report" | "reported" | "block" | "end"
  >("none");
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const detailsRequired = reason !== null && reportNeedsDetails(reason);

  function close() {
    setSheet("none");
    setReason(null);
    setDetails("");
    setDetailsError(null);
  }

  async function submitReport() {
    if (pending || !reason) return;

    // Checked here so the member is told what is missing rather than handed a
    // failure. The database checks it again and is the one that decides.
    if (reportNeedsDetails(reason) && !details.trim()) {
      setDetailsError(t("report.detailsMissing"));
      return;
    }

    setPending(true);
    const outcome = await reportAndBlockMember(memberId, reason, details);
    setPending(false);

    if (!outcome.ok) {
      if (outcome.problem === "details") {
        setDetailsError(t("report.detailsMissing"));
        return;
      }
      toast.show(
        outcome.problem === "reason"
          ? t("report.reasonMissing")
          : t("report.failed"),
        "danger",
      );
      return;
    }

    // Kept open, on the confirmation. `close()` would clear the reason behind
    // the panel that is still being read.
    setSheet("reported");
  }

  async function submitBlock() {
    setPending(true);
    const ok = await blockMember(memberId);
    setPending(false);
    close();

    if (!ok) {
      toast.show(t("safety.actionFailed"), "danger");
      return;
    }

    toast.show(t("safety.blockedToast", { name: memberName }), "positive");
    onDone();
  }

  async function submitEnd() {
    if (!connectionId) return;
    setPending(true);
    const ok = await endConnection(connectionId);
    setPending(false);
    close();

    if (!ok) {
      toast.show(t("safety.actionFailed"), "danger");
      return;
    }

    toast.show(t("safety.connectionEnded"));
    onDone();
  }

  return (
    <View style={style}>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: space.lg,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.xl,
        }}
      >
        {connectionId ? (
          <TextButton
            label={t("safety.endTitle")}
            tone="muted"
            onPress={() => setSheet("end")}
          />
        ) : null}
        <TextButton
          label={t("messages.blockCta")}
          tone="muted"
          onPress={() => setSheet("block")}
        />
        <TextButton
          label={t("messages.reportCta")}
          tone="muted"
          onPress={() => setSheet("report")}
        />
      </View>

      <ConfirmSheet
        visible={sheet === "end"}
        onClose={close}
        title={t("safety.endTitleNamed", { name: memberName })}
        body={t("safety.endPoint1")}
        points={[
          t("safety.cannotBeUndone"),
          t("safety.endNotTold", { name: memberName }),
          t("safety.endPoint2"),
        ]}
        cancelLabel={t("safety.keepConnection")}
        confirmLabel={t("safety.endTitle")}
        destructive
        pending={pending}
        onConfirm={() => void submitEnd()}
      />

      <ConfirmSheet
        visible={sheet === "block"}
        onClose={close}
        title={t("safety.blockTitleNamed", { name: memberName })}
        body={t("safety.blockPoint1")}
        points={[
          t("safety.blockNotTold", { name: memberName }),
          t("safety.blockPoint2"),
          t("safety.blockPoint3"),
        ]}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("safety.blockConfirmNamed", { name: memberName })}
        destructive
        pending={pending}
        onConfirm={() => void submitBlock()}
      />

      <BottomSheet
        visible={sheet === "report"}
        onClose={close}
        title={t("report.title", { name: memberName })}
      >
        <Text variant="body" tone="muted">
          {t("report.body", { name: memberName })}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: space.md,
            marginTop: space.lg,
            padding: space.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.sand,
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={iconSize.md}
            color={colors.inkMuted}
          />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {t("report.note")}
          </Text>
        </View>

        <Text variant="label" style={{ marginTop: space.xxl }}>
          {t("report.reasonLabel", { name: memberName })}
        </Text>

        <View style={{ gap: space.sm, marginTop: space.md }}>
          {REPORT_REASONS.map((code) => (
            <SelectionCard
              key={code}
              label={t(reportReasonKey(code))}
              selected={reason === code}
              onPress={() => {
                setReason(code);
                setDetailsError(null);
              }}
            />
          ))}
        </View>

        <Field
          label={t("report.detailsLabel")}
          hint={
            detailsRequired
              ? t("report.detailsRequired")
              : t("report.detailsOptional")
          }
          error={detailsError}
          value={details}
          onChangeText={(next) => {
            setDetails(next);
            if (detailsError) setDetailsError(null);
          }}
          placeholder={t("report.detailsPlaceholder")}
          multiline
          numberOfLines={4}
          maxLength={2000}
          containerStyle={{ marginTop: space.xxl }}
          style={{ minHeight: hit.large, textAlignVertical: "top" }}
        />

        {/* Cancel first and calmer: the destructive button should not be
            where a thumb lands by habit. */}
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          <Button
            label={t("report.cancel")}
            variant="secondary"
            disabled={pending}
            onPress={close}
          />
          <Button
            label={t("report.submit", { name: memberName })}
            variant="danger"
            disabled={!reason}
            loading={pending}
            onPress={() => void submitReport()}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "reported"}
        onClose={() => {
          close();
          onDone();
        }}
        title={t("report.doneTitle", { name: memberName })}
      >
        <Text variant="body" tone="muted">
          {t("report.doneBody", { name: memberName })}
        </Text>

        <View style={{ marginTop: space.xxl }}>
          <Button
            label={t("report.doneCta")}
            onPress={() => {
              close();
              onDone();
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
