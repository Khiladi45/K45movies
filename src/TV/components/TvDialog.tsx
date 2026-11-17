import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Focusable from "./Focusable";
import { TV } from "../theme";

export type TvDialogAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Remote-friendly action dialog. A Modal is its own window on Android TV, so
 * D-pad focus stays inside it; the first action has focus; Back closes it.
 */
export default function TvDialog({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: TvDialogAction[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <Focusable
                key={action.label}
                hasTVPreferredFocus={index === 0}
                style={styles.action}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
              >
                {action.icon ? (
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={action.destructive ? "#f87171" : "#fff"}
                  />
                ) : null}
                <Text style={[styles.actionText, action.destructive && styles.destructive]}>
                  {action.label}
                </Text>
              </Focusable>
            ))}
            <Focusable style={styles.action} onPress={onClose}>
              <Ionicons name="close" size={18} color={TV.muted} />
              <Text style={[styles.actionText, { color: TV.muted }]}>Cancel</Text>
            </Focusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 380,
    maxWidth: "80%",
    padding: 20,
    borderRadius: 12,
    backgroundColor: TV.surface,
  },
  title: { color: "#fff", fontSize: TV.text.row, fontWeight: "800" },
  subtitle: { color: TV.muted, fontSize: TV.text.small, marginTop: 4 },
  actions: { marginTop: 14, gap: 6 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  destructive: { color: "#f87171" },
});
