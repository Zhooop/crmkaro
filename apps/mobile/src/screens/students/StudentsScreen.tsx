import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { apiFetch } from "../../api/client";
import { colors, radius, spacing } from "../../theme/colors";

type Student = {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  rollNumber?: string;
  standard?: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "UNMARKED";
};

export function StudentsScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await apiFetch<any>("/students");
      if (res.data?.items) {
        setStudents(
          res.data.items.map((s: any) => ({
            id: s.id,
            displayName: s.person?.displayName || s.displayName || "Student",
            primaryPhone: s.person?.primaryPhone || s.primaryPhone,
            rollNumber: s.rollNumber || "R-01",
            standard: s.standard || "Grade 10",
            status: "UNMARKED",
          }))
        );
      } else {
        // Fallback sample
        setStudents([
          { id: "s1", displayName: "Aarav Sharma", primaryPhone: "+91 9820123456", rollNumber: "R-01", standard: "Batch A", status: "PRESENT" },
          { id: "s2", displayName: "Diya Patel", primaryPhone: "+91 9876543210", rollNumber: "R-02", standard: "Batch A", status: "UNMARKED" },
          { id: "s3", displayName: "Kabir Khan", primaryPhone: "+91 9988776655", rollNumber: "R-03", standard: "Batch B", status: "ABSENT" },
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const markAttendance = (id: string, status: "PRESENT" | "ABSENT" | "LATE") => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Students & Attendance"
        subtitle="Daily Attendance Register & Profiles"
      />

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchStudents();
            }}
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <View style={styles.studentMeta}>
              <View style={styles.rollBadge}>
                <Text style={styles.rollText}>{item.rollNumber || "ST"}</Text>
              </View>
              <View style={styles.nameWrap}>
                <Text style={styles.studentName}>{item.displayName}</Text>
                <Text style={styles.studentStandard}>{item.standard || "Regular Batch"}</Text>
              </View>
            </View>

            {/* Attendance Buttons */}
            <View style={styles.attendanceRow}>
              <TouchableOpacity
                onPress={() => markAttendance(item.id, "PRESENT")}
                style={[
                  styles.attBtn,
                  item.status === "PRESENT" && styles.presentActive,
                ]}
              >
                <Text
                  style={[
                    styles.attBtnText,
                    item.status === "PRESENT" && styles.textWhite,
                  ]}
                >
                  P
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => markAttendance(item.id, "LATE")}
                style={[
                  styles.attBtn,
                  item.status === "LATE" && styles.lateActive,
                ]}
              >
                <Text
                  style={[
                    styles.attBtnText,
                    item.status === "LATE" && styles.textWhite,
                  ]}
                >
                  L
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => markAttendance(item.id, "ABSENT")}
                style={[
                  styles.attBtn,
                  item.status === "ABSENT" && styles.absentActive,
                ]}
              >
                <Text
                  style={[
                    styles.attBtnText,
                    item.status === "ABSENT" && styles.textWhite,
                  ]}
                >
                  A
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  studentMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rollBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  rollText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
  },
  nameWrap: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  studentStandard: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 6,
  },
  attBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  attBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
  },
  presentActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  absentActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  lateActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  textWhite: {
    color: "#ffffff",
  },
});
