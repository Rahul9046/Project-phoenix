import { View } from "react-native";
import type { LegalDocument } from "@eraya/legal";
import { LEGAL_EFFECTIVE_DATE, operator } from "@eraya/legal";

import { useT } from "@/features/i18n/LocaleProvider";
import { colors, radius, space } from "@/theme/tokens";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * A legal document, rendered for the app.
 *
 * The document is data in `@eraya/legal`, shared with the website, so the two
 * cannot say different things about the same clause. This file only decides how
 * it looks on a phone.
 *
 * The documents are English; the notice explaining that is not. Somebody
 * reading Eraya in Marathi should be told, in Marathi, that the English is what
 * governs -- rather than being left to work it out from the fact that the page
 * in front of them is not in their language.
 */
export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const t = useT();

  return (
    <Screen bottomSpace={space.region}>
      <Text variant="body" tone="muted">
        {document.lede}
      </Text>

      <Text variant="caption" tone="subtle" style={{ marginTop: space.lg }}>
        {t("common.legalEffectiveFrom", { date: LEGAL_EFFECTIVE_DATE })}
      </Text>

      <View
        style={{
          marginTop: space.xl,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.sand,
        }}
      >
        <Text variant="caption" tone="muted">
          {t("common.legalEnglishOnly")}
        </Text>
      </View>

      {document.sections.map((section) => (
        <View key={section.id} style={{ marginTop: space.section }}>
          <Text variant="headline">{section.heading}</Text>

          {section.blocks.map((block, index) => {
            if (block.kind === "subheading") {
              return (
                <Text
                  key={index}
                  variant="bodyStrong"
                  style={{ marginTop: space.xl }}
                >
                  {block.text}
                </Text>
              );
            }

            if (block.kind === "list") {
              return (
                <View key={index} style={{ marginTop: space.lg, gap: space.md }}>
                  {block.items.map((item) => (
                    <View
                      key={item}
                      style={{ flexDirection: "row", gap: space.md }}
                    >
                      {/*
                        A typed bullet rather than an icon. These lists run long
                        and an icon per line reads as a checklist of features,
                        which is the wrong tone for a list of things not to do.
                      */}
                      <Text variant="bodySm" tone="subtle">
                        •
                      </Text>
                      <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            }

            return (
              <Text
                key={index}
                variant="bodySm"
                tone="muted"
                style={{ marginTop: space.lg }}
              >
                {block.text}
              </Text>
            );
          })}
        </View>
      ))}

      <Text
        variant="caption"
        tone="subtle"
        style={{ marginTop: space.region }}
      >
        {operator.name}, trading as {operator.tradingAs}, {operator.country}.{" "}
        {operator.contactEmail}
      </Text>
    </Screen>
  );
}
