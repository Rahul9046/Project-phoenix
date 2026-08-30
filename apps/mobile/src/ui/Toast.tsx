import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, elevation, iconSize, motion, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * A brief confirmation that something happened.
 *
 * Used where an action succeeds and the screen does not otherwise change --
 * interest sent, filters cleared, a report filed. Without it those actions feel
 * like nothing happened at all.
 *
 * It appears at the top rather than the bottom. The bottom of the screen is
 * where the tab bar, the message composer and most primary buttons live, and a
 * toast that covers the control you just used is worse than no toast.
 *
 * There is no action button and no queue. A toast that can be interacted with is
 * a dialog wearing a disguise, and a queue means the third message is read
 * several seconds after the thing it describes.
 */

type ToastTone = "neutral" | "positive" | "danger";

type ToastState = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastState | null>(null);

const DURATION = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>("neutral");
  const [opacity] = useState(() => new Animated.Value(0));
  const [offset] = useState(() => new Animated.Value(-12));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.base,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: -12,
        duration: motion.base,
        useNativeDriver: true,
      }),
    ]).start(() => setMessage(null));
  }, [opacity, offset]);

  const show = useCallback(
    (next: string, nextTone: ToastTone = "neutral") => {
      if (timer.current) clearTimeout(timer.current);

      setMessage(next);
      setTone(nextTone);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.base,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: 0,
          duration: motion.base,
          useNativeDriver: true,
        }),
      ]).start();

      timer.current = setTimeout(hide, DURATION);
    },
    [hide, opacity, offset],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo<ToastState>(() => ({ show }), [show]);

  const icon =
    tone === "positive"
      ? "checkmark-circle"
      : tone === "danger"
        ? "alert-circle"
        : "information-circle";
  const iconColor =
    tone === "positive"
      ? colors.positive
      : tone === "danger"
        ? colors.danger
        : colors.inkMuted;

  return (
    <ToastContext.Provider value={value}>
      {children}

      {message ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessible
          accessibilityLabel={message}
          style={{
            position: "absolute",
            top: insets.top + space.sm,
            left: space.gutter,
            right: space.gutter,
            opacity,
            transform: [{ translateY: offset }],
          }}
        >
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingVertical: space.lg,
                paddingHorizontal: space.xl,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.surface,
              },
              elevation.raised,
            ]}
          >
            <Ionicons name={icon} size={iconSize.md} color={iconColor} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
