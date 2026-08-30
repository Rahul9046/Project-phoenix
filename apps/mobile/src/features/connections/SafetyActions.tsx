import { useState } from "react";
import { View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  blockMember,
  endConnection,
  reportMember,
  reportReasons,
  type ReportReason,
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
 * Two decisions built into the behaviour:
 *
 * Reporting blocks as well. A report that only files a row into a table nobody
 * is reading yet is an affordance that looks like protection and is not; the
 * block is immediate and enforced in the database, so filing a report always
 * does something real.
 *
 * The wording never promises a review. There is no moderation team and no queue,
 * so it says the report is recorded and the person is blocked -- both true --
 * and nothing about anybody reading it. When a review process exists, this copy
 * changes and not before.
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
  const toast = useToast();
  const [sheet, setSheet] = useState<"none" | "report" | "block" | "end">(
    "none",
  );
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setSheet("none");
    setReason(null);
    setDescription("");
  }

  async function submitReport() {
    if (!reason) return;
    setPending(true);

    const filed = await reportMember(memberId, reason, description);
    // The block is what actually protects them, so it runs even if the report
    // failed to record.
    const blocked = await blockMember(memberId);

    setPending(false);
    close();

    if (!blocked) {
      toast.show("That did not go through. Please try again.", "danger");
      return;
    }

    toast.show(
      filed
        ? `${memberName} is blocked, and your report is recorded.`
        : `${memberName} is blocked.`,
      "positive",
    );
    onDone();
  }

  async function submitBlock() {
    setPending(true);
    const ok = await blockMember(memberId);
    setPending(false);
    close();

    if (!ok) {
      toast.show("That did not go through. Please try again.", "danger");
      return;
    }

    toast.show(`${memberName} is blocked.`, "positive");
    onDone();
  }

  async function submitEnd() {
    if (!connectionId) return;
    setPending(true);
    const ok = await endConnection(connectionId);
    setPending(false);
    close();

    if (!ok) {
      toast.show("That did not go through. Please try again.", "danger");
      return;
    }

    toast.show("The connection has ended.");
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
            label="End connection"
            tone="muted"
            onPress={() => setSheet("end")}
          />
        ) : null}
        <TextButton
          label="Block"
          tone="muted"
          onPress={() => setSheet("block")}
        />
        <TextButton
          label="Report"
          tone="muted"
          onPress={() => setSheet("report")}
        />
      </View>

      <ConfirmSheet
        visible={sheet === "end"}
        onClose={close}
        title={`End your connection with ${memberName}?`}
        body="Neither of you will be able to send anything further. What has already been said stays readable to you both."
        points={[
          "This cannot be undone.",
          `${memberName} is not told that you ended it.`,
          "They will not appear in your introductions again.",
        ]}
        cancelLabel="Keep the connection"
        confirmLabel="End connection"
        destructive
        pending={pending}
        onConfirm={() => void submitEnd()}
      />

      <ConfirmSheet
        visible={sheet === "block"}
        onClose={close}
        title={`Block ${memberName}?`}
        body="You will not see each other again anywhere in Eraya, and neither of you can send the other anything."
        points={[
          `${memberName} is not told that you blocked them.`,
          "Any conversation between you is closed.",
          "This is enforced by Eraya, not just hidden from view.",
        ]}
        cancelLabel="Cancel"
        confirmLabel={`Block ${memberName}`}
        destructive
        pending={pending}
        onConfirm={() => void submitBlock()}
      />

      <BottomSheet
        visible={sheet === "report"}
        onClose={close}
        title={`Report ${memberName}`}
      >
        <Text variant="body" tone="muted">
          {memberName} will be blocked straight away. Your report is recorded
          with whatever you tell us below.
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
            Eraya is small and has no moderation team yet, so we cannot promise
            anyone will reply. Blocking takes effect immediately either way.
          </Text>
        </View>

        <Text variant="label" style={{ marginTop: space.xxl }}>
          What happened?
        </Text>

        <View style={{ gap: space.sm, marginTop: space.md }}>
          {reportReasons.map((option) => (
            <SelectionCard
              key={option.value}
              label={option.label}
              selected={reason === option.value}
              onPress={() => setReason(option.value)}
            />
          ))}
        </View>

        <Field
          label="Anything you want to add"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional, but it is the only thing we will have to go on."
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
            label="Cancel"
            variant="secondary"
            disabled={pending}
            onPress={close}
          />
          <Button
            label={`Block and report ${memberName}`}
            variant="danger"
            disabled={!reason}
            loading={pending}
            onPress={() => void submitReport()}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
