import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { supabase } from "@/lib/supabase/client";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card } from "@/ui/Surface";
import { EmptyState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * People you have blocked.
 *
 * Names are deliberately absent. A block hides both people from each other in
 * both directions -- `member_profile` refuses, so there is no way to read their
 * details any more, and building a back door for this screen would mean
 * weakening the rule for everybody in order to render a list.
 *
 * What is shown instead is the count and the date, which is enough to recognise
 * one and undo it. That is the honest consequence of a block being real rather
 * than cosmetic, and it is worth the trade.
 */
type Block = { blockedId: string; createdAt: string };

export default function Blocked() {
  const toast = useToast();
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const fetchBlocks = useCallback(async (): Promise<Block[]> => {
    const { data } = await supabase
      .from("member_blocks")
      .select("blocked_id, created_at")
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => ({
      blockedId: row.blocked_id,
      createdAt: row.created_at,
    }));
  }, []);

  /*
   * The fetch is written out here rather than hidden behind a callback that
   * setStates on its own. Data functions return data and the component owns its
   * state -- which keeps the cancellation visible at the point it matters and
   * makes the effect's dependencies the actual inputs to the query.
   */
  useEffect(() => {
    let active = true;
    void fetchBlocks().then((rows) => {
      if (active) setBlocks(rows);
    });
    return () => {
      active = false;
    };
  }, [fetchBlocks]);

  async function unblock(id: string) {
    setPending(id);

    const { error } = await supabase
      .from("member_blocks")
      .delete()
      .eq("blocked_id", id);

    setPending(null);

    if (error) {
      toast.show("That did not go through. Please try again.", "danger");
      return;
    }

    setBlocks(await fetchBlocks());
    toast.show("Unblocked. You may see each other again.");
  }

  if (blocks === null) {
    return (
      <Screen>
        <LoadingState label="Loading blocked people" />
      </Screen>
    );
  }

  return (
    <Screen>
      {blocks.length === 0 ? (
        <EmptyState
          icon="hand-left-outline"
          title="You have not blocked anyone"
          body="If you ever need to, blocking is on every profile and in every conversation. It takes effect immediately and the other person is never told."
        />
      ) : (
        <View>
          <Text variant="body" tone="muted">
            Blocking hides you from each other completely, so we can no longer
            show you their name or their photo. Unblocking makes you both visible
            again.
          </Text>

          <View style={{ marginTop: space.xl, gap: space.md }}>
            {blocks.map((block) => (
              <Card key={block.blockedId}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.lg,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="label">Blocked member</Text>
                    <Text
                      variant="caption"
                      tone="subtle"
                      style={{ marginTop: space.xxs }}
                    >
                      Since{" "}
                      {new Date(block.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                  </View>

                  <Button
                    label="Unblock"
                    variant="secondary"
                    size="md"
                    block={false}
                    loading={pending === block.blockedId}
                    onPress={() => void unblock(block.blockedId)}
                  />
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}
