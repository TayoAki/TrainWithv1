import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  TextStyle,
  ViewStyle,
  StyleProp,
  KeyboardTypeOptions,
} from "react-native";
import { Image, ImageStyle } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Search,
  CalendarDays,
  UserRound,
  LayoutDashboard,
  Layers,
  Users,
  Wallet,
  Dumbbell,
  ChevronRight,
} from "lucide-react-native";
import { photos } from "./data";
const bundledPhotos: Record<string, number> = {
  [photos.strength]: require("../assets/photos/strength.jpg"),
  [photos.mobility]: require("../assets/photos/mobility.jpg"),
  [photos.pilates]: require("../assets/photos/pilates.jpg"),
  [photos.workout]: require("../assets/photos/workout.jpg"),
};
/**
 * Palette. Every text colour here clears WCAG AA (4.5:1) for normal text on
 * the surfaces it is used on — bg, white and sage. `muted` is the tight one:
 * it carries captions at 11-13px, which count as normal text, so it cannot be
 * lightened without failing contrast.
 */
export const C = {
  bg: "#F7F8F5",
  white: "#FFFFFF",
  ink: "#172B24",
  green: "#173F32",
  sage: "#E9EFE7",
  lime: "#DCF58C",
  muted: "#626E66",
  line: "#E2E7DF",
  red: "#A34232",
};
export const go = (
  router: ReturnType<typeof useRouter>,
  screen: string,
  id?: string,
) =>
  router.push({
    pathname: "/screen/[page]",
    params: { page: screen, ...(id ? { id } : {}) },
  });
export function T({
  children,
  size = 15,
  bold = false,
  color = C.ink,
  style,
  accessibilityRole,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: TextStyle;
  accessibilityRole?: "header" | "text" | "link";
  numberOfLines?: number;
}) {
  return (
    <Text
      selectable
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          color,
          fontWeight: bold ? "700" : "400",
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Row({
  children,
  between = false,
  style,
}: {
  children: React.ReactNode;
  between?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 12 },
        between && { justifyContent: "space-between" },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.white,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: C.line,
          padding: 20,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Badge({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 7,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: light ? C.sage : C.lime,
      }}
    >
      <T size={11} bold>
        {children}
      </T>
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  subtle = false,
  disabled = false,
  icon,
  loading = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  subtle?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 13,
        paddingHorizontal: 20,
        paddingVertical: 13,
        backgroundColor: subtle ? "transparent" : secondary ? C.sage : C.green,
        opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        borderWidth: subtle ? 1 : 0,
        borderColor: C.line,
      })}
    >
      {loading ? <ActivityIndicator color={C.white} /> : icon}
      <T
        size={14}
        bold
        color={secondary || subtle ? C.ink : C.white}
        numberOfLines={1}
      >
        {title}
      </T>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder = "",
  multiline = false,
  keyboardType = "default",
  error,
  editable = true,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <T bold size={13}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={!!error}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        editable={editable}
        secureTextEntry={secureTextEntry}
        autoCorrect={!secureTextEntry}
        style={{
          borderWidth: 1,
          borderColor: error ? C.red : C.line,
          borderRadius: 12,
          backgroundColor: C.white,
          color: C.ink,
          padding: 15,
          fontSize: 15,
          minHeight: 50,
          ...(multiline ? { height: 112, textAlignVertical: "top" } : {}),
        }}
      />
      {!!error && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <T size={12} color={C.red}>
            {error}
          </T>
        </View>
      )}
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {items.map((x) => (
        <Pressable
          key={x}
          accessibilityRole="button"
          accessibilityState={{ selected: value === x }}
          onPress={() => onChange(x)}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 11,
            minHeight: 44,
            justifyContent: "center",
            borderRadius: 24,
            backgroundColor: value === x ? C.green : C.sage,
          }}
        >
          <T size={13} bold color={value === x ? C.white : C.ink}>
            {x}
          </T>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Photo({
  uri,
  height = 220,
  style,
}: {
  uri: string;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={bundledPhotos[uri] || { uri }}
      contentFit="cover"
      transition={180}
      style={[
        { width: "100%", height, borderRadius: 15, backgroundColor: C.sage },
        style,
      ]}
    />
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8, marginBottom: 8 }}>
      {eyebrow && (
        <T size={11} bold color={C.muted} style={{ letterSpacing: 2 }}>
          {eyebrow.toUpperCase()}
        </T>
      )}
      <Row between>
        <T
          size={30}
          bold
          accessibilityRole="header"
          style={{ letterSpacing: -1, flex: 1 }}
        >
          {title}
        </T>
        {action}
      </Row>
      {!!description && <T color={C.muted}>{description}</T>}
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion={error ? "polite" : "none"}
      style={{
        backgroundColor: error ? "#F9EAE5" : C.sage,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <T size={13} color={error ? C.red : C.green}>
        {children}
      </T>
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={{ paddingVertical: 38, alignItems: "center" }}>
      <Dumbbell size={32} color={C.muted} />
      <T size={21} bold>
        {title}
      </T>
      <T color={C.muted} style={{ textAlign: "center" }}>
        {description}
      </T>
      {action}
    </Card>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{
        height: 7,
        borderRadius: 10,
        backgroundColor: C.sage,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 7,
          width: `${Math.min(value, 1) * 100}%`,
          backgroundColor: C.green,
          borderRadius: 10,
        }}
      />
    </View>
  );
}
export function Item({
  title,
  subtitle,
  onPress,
  photo,
  icon,
  end,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  photo?: string;
  icon?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
        borderBottomWidth: 1,
        borderColor: C.line,
      })}
    >
      {photo ? (
        <Photo
          uri={photo}
          height={66}
          style={{ width: 82, borderRadius: 10 }}
        />
      ) : icon ? (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: C.sage,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <T bold>{title}</T>
        {!!subtitle && (
          <T size={12} color={C.muted}>
            {subtitle}
          </T>
        )}
      </View>
      {end || <ChevronRight size={18} color={C.muted} />}
    </Pressable>
  );
}
type NavTab = [
  label: string,
  route: string,
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>,
];
export function Shell({
  children,
  creator = false,
  title,
  back = false,
  wide = false,
}: {
  children: React.ReactNode;
  creator?: boolean;
  title?: string;
  back?: boolean;
  wide?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width > 900;
  const insets = useSafeAreaInsets();
  const tabs: NavTab[] = creator
    ? [
        ["Studio", "studio", LayoutDashboard],
        ["Content", "content", Layers],
        ["Members", "members", Users],
        ["Earnings", "earnings", Wallet],
      ]
    : [
        ["Discover", "discover", Search],
        ["My workouts", "my-workouts", CalendarDays],
        ["Profile", "profile", UserRound],
      ];
  const nav = (vertical = false) => (
    <View
      style={{
        flexDirection: vertical ? "column" : "row",
        gap: vertical ? 8 : 0,
        ...(!vertical ? { justifyContent: "space-around" as const } : {}),
      }}
    >
      {tabs.map(([label, route, Icon]) => {
        const active =
          path.endsWith(route) || (route === "discover" && path === "/");
        return (
          <Pressable
            key={route}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => go(router, route)}
            style={({ pressed }) => ({
              flexDirection: vertical ? "row" : "column",
              alignItems: "center",
              gap: vertical ? 12 : 5,
              padding: vertical ? 15 : 10,
              backgroundColor: active && vertical ? C.sage : "transparent",
              borderRadius: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon
              size={21}
              strokeWidth={active ? 2.3 : 1.6}
              color={active ? C.green : C.muted}
            />
            <T
              size={vertical ? 14 : 10}
              bold={active}
              color={active ? C.green : C.muted}
            >
              {label}
            </T>
            {vertical && active && (
              <View
                style={{
                  marginLeft: "auto",
                  width: 6,
                  height: 6,
                  backgroundColor: C.green,
                  borderRadius: 3,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        paddingTop: insets.top,
        flexDirection: "row",
      }}
    >
      {desktop && (
        <View
          style={{
            width: 264,
            borderRightWidth: 1,
            borderColor: C.line,
            padding: 25,
            backgroundColor: C.white,
            gap: 35,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="TrainWith home"
            onPress={() => go(router, "discover")}
          >
            <Row>
              <View
                style={{
                  backgroundColor: C.green,
                  padding: 8,
                  borderRadius: 11,
                }}
              >
                <Dumbbell color={C.lime} size={20} />
              </View>
              <T bold size={22} style={{ letterSpacing: -1 }}>
                trainwith
              </T>
            </Row>
          </Pressable>
          <T size={10} bold color={C.muted} style={{ letterSpacing: 2 }}>
            {creator ? "YOUR CREATOR STUDIO" : "YOUR EVERYDAY, STRONGER"}
          </T>
          {nav(true)}
          <View style={{ marginTop: "auto", gap: 12 }}>
            <Card
              style={{
                backgroundColor: C.sage,
                borderWidth: 0,
                padding: 16,
                gap: 10,
              }}
            >
              <T bold size={13}>
                {creator
                  ? "See it through their eyes."
                  : "Your knowledge. Their progress."}
              </T>
              <T size={12} color={C.muted}>
                {creator
                  ? "Switch to the member experience."
                  : "Build a channel. Share your workouts."}
              </T>
              <Button
                title={creator ? "Member view" : "Become a creator"}
                secondary
                onPress={() =>
                  go(router, creator ? "discover" : "creator-start")
                }
              />
            </Card>
            <T size={11} color={C.muted}>
              © {new Date().getFullYear()} TrainWith
            </T>
          </View>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 70,
            borderBottomWidth: 1,
            borderColor: C.line,
            paddingHorizontal: desktop ? 36 : 20,
            backgroundColor: C.white,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Row>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : go(router, creator ? "studio" : "discover")
                }
                // 21px icon plus 12px padding keeps the tap target at 45.
                style={{ padding: 12, marginLeft: -12 }}
              >
                <ArrowLeft color={C.ink} size={21} />
              </Pressable>
            )}
            <T bold size={desktop ? 16 : 22} style={{ letterSpacing: -0.5 }}>
              {title ||
                (creator
                  ? "Creator studio"
                  : desktop
                    ? "Discover your next chapter."
                    : "trainwith")}
            </T>
          </Row>
          <Row>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={creator ? "Creator settings" : "Your profile"}
              onPress={() =>
                go(router, creator ? "creator-settings" : "profile")
              }
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: C.green,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserRound color={C.white} size={17} />
              </View>
            </Pressable>
          </Row>
        </View>
        <ScrollView
          key={path}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: desktop ? 36 : 20,
            paddingBottom: 35,
            gap: 22,
            width: "100%",
            maxWidth: wide ? 1200 : 820,
            alignSelf: "center",
          }}
        >
          {children}
        </ScrollView>
        {!desktop && (
          <View
            style={{
              backgroundColor: C.white,
              borderTopWidth: 1,
              borderColor: C.line,
              paddingBottom: Math.max(insets.bottom, 6),
            }}
          >
            {nav()}
          </View>
        )}
      </View>
    </View>
  );
}
