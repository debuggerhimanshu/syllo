import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

type SelectedFile = {
  name: string;
  uri: string;
  mimeType: string | undefined;
  size: number | undefined;
};

export default function ImportFFCS() {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [picking, setPicking] = useState(false);

  // Open file picker
  const pickTimetable = async () => {
    try {
      setPicking(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const selected = result.assets[0];

      setFile({
        name: selected.name,
        uri: selected.uri,
        mimeType: selected.mimeType,
        size: selected.size,
      });
    } catch (error) {
      console.error("Document picker error:", error);
    } finally {
      setPicking(false);
    }
  };

  // Remove selected file
  const removeFile = () => {
    setFile(null);
  };

  // Format file size
  const formatFileSize = (size: number | undefined) => {
    if (!size) {
      return "Unknown size";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      {!file ? (
        <>
          {/* Upload state */}
          <Text style={styles.title}>
            Import FFCS Timetable
          </Text>

          <Text style={styles.subtitle}>
            Upload your FFCS timetable and Syllo will
            automatically create your schedule.
          </Text>

          <TouchableOpacity
            style={styles.uploadButton}
            activeOpacity={0.8}
            disabled={picking}
            onPress={pickTimetable}
          >
            {picking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.uploadButtonText}>
                Upload Timetable
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Review state */}
          <Text style={styles.title}>
            Review Timetable
          </Text>

          <Text style={styles.subtitle}>
            Make sure this is the correct FFCS timetable
            before continuing.
          </Text>

          {/* Preview */}
          <View style={styles.previewCard}>
            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeButton}
              activeOpacity={0.8}
              onPress={removeFile}
            >
              <Text style={styles.removeButtonText}>
                ×
              </Text>
            </TouchableOpacity>

            {/* PDF preview */}
            {file.mimeType === "application/pdf" ? (
              <>
                <View style={styles.previewIcon}>
                  <Text style={styles.previewIconText}>
                    PDF
                  </Text>
                </View>

                <Text style={styles.previewLabel}>
                  PDF Timetable
                </Text>

                <Text style={styles.previewNote}>
                  This PDF is ready to be processed.
                </Text>
              </>
            ) : (
              /* Image preview */
              <Image
                source={{ uri: file.uri }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            )}
          </View>

          {/* File information */}
          <View style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>
                {file.mimeType === "application/pdf"
                  ? "PDF"
                  : "IMG"}
              </Text>
            </View>

            <View style={styles.fileInfo}>
              <Text
                style={styles.fileName}
                numberOfLines={2}
              >
                {file.name}
              </Text>

              <Text style={styles.fileSize}>
                {formatFileSize(file.size)}
              </Text>
            </View>
          </View>

          {/* Continue */}
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.8}
            onPress={() => {
                router.push("/processing-ffcs");
            }}
          >
            <Text style={styles.continueButtonText}>
              Continue
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    padding: 28,
    paddingTop: 70,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 30,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 340,
  },

  /* Upload button */
  uploadButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
  },

  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Preview */
  previewCard: {
    height: 260,
    marginTop: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#20232B",
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },

  imagePreview: {
    width: "100%",
    height: "100%",
  },

  /* Remove button */
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#20232B",
    alignItems: "center",
    justifyContent: "center",
  },

  removeButtonText: {
    color: "#F5F7FA",
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 24,
  },

  /* PDF preview */
  previewIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#171322",
    alignItems: "center",
    justifyContent: "center",
  },

  previewIconText: {
    color: "#A78BFA",
    fontSize: 18,
    fontWeight: "800",
  },

  previewLabel: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
  },

  previewNote: {
    color: "#777D8A",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },

  /* File card */
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },

  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#171322",
    alignItems: "center",
    justifyContent: "center",
  },

  fileIconText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "800",
  },

  fileInfo: {
    flex: 1,
    marginLeft: 14,
  },

  fileName: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "600",
  },

  fileSize: {
    color: "#777D8A",
    fontSize: 12,
    marginTop: 5,
  },

  /* Continue */
  continueButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});