import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { colors, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * A member's photos: one large, the rest as thumbnails beneath.
 *
 * This was a horizontally paged gallery, which is the shape people expect, and
 * it did not survive contact with layout. A child of a horizontal ScrollView has
 * no width to take a percentage of and no height to derive from `aspectRatio` --
 * both resolve to zero, so the images loaded correctly and drew at 0x0. Sizing
 * the pages from a measured width fixed the arithmetic and not the problem.
 *
 * Every dimension here is either a fixed number or an `aspectRatio` on an
 * ordinary View, which is the pattern the discovery card already uses and which
 * is known to work. Tapping a thumbnail swaps the main photo. It is a smaller
 * idea than paging, and it cannot silently render nothing -- on a screen whose
 * whole job is showing a person, that is the trade worth making.
 *
 * With one photo the strip disappears and this is indistinguishable from a plain
 * image, which is right: most members will have one or none.
 */
export function PhotoGallery({
  name,
  photos,
}: {
  name: string;
  /** Signed URLs, in the member's own order. Empty is a normal state. */
  photos: string[];
}) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return <NoPhoto name={name} />;
  }

  const current = photos[Math.min(index, photos.length - 1)]!;

  return (
    <View>
      {/*
        The aspect ratio lives on this View, which is an ordinary box and sizes
        itself correctly; the image fills it absolutely rather than deriving a
        height from a parent that does not have one yet.
      */}
      <View
        style={{
          width: "100%",
          aspectRatio: 4 / 5,
          borderRadius: radius.xl,
          overflow: "hidden",
          backgroundColor: colors.sandDeep,
        }}
      >
        <Image
          source={{ uri: current }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
          accessibilityLabel={
            photos.length === 1
              ? `${name}'s photo`
              : `${name}'s photo ${index + 1} of ${photos.length}`
          }
        />
      </View>

      {photos.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingTop: space.md }}
        >
          {photos.map((uri, position) => (
            <Pressable
              key={uri}
              accessibilityRole="button"
              accessibilityState={{ selected: position === index }}
              accessibilityLabel={`Show photo ${position + 1} of ${photos.length}`}
              onPress={() => setIndex(position)}
              // Fixed dimensions: a scroll child is the other place a
              // percentage resolves against nothing.
              style={{
                width: 56,
                height: 70,
                borderRadius: radius.md,
                overflow: "hidden",
                borderWidth: position === index ? 2 : 1,
                borderColor:
                  position === index ? colors.ember : colors.lineStrong,
                backgroundColor: colors.sandDeep,
              }}
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/**
 * No photo, presented as a choice rather than a gap.
 *
 * Plenty of Eraya's members will not want a face on a screen for a long time,
 * and their profile has to look considered rather than unfinished.
 */
function NoPhoto({ name }: { name: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${name} has not added a photo`}
      style={{
        width: "100%",
        aspectRatio: 4 / 5,
        borderRadius: radius.xl,
        backgroundColor: colors.sandDeep,
        alignItems: "center",
        justifyContent: "center",
        gap: space.md,
      }}
    >
      <Text
        variant="display"
        style={{ fontSize: 72, lineHeight: 86, color: colors.brandBrown }}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
      <Text variant="bodySm" tone="muted">
        No photo yet
      </Text>
    </View>
  );
}
