import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import MlkitOcr from 'react-native-mlkit-ocr';
import RNFetchBlob from 'rn-fetch-blob';

type OCRCameraProps = {
  onDetailsExtracted: (details: {
    sn: string | null;
    pin: string | null;
    pw: string | null;
    fullText: string;
  }) => void;
};

const uriToContentUri = async (filePath: string): Promise<string | null> => {
  if (Platform.OS === 'android') {
    const stat = await RNFetchBlob.fs.stat(filePath);
    return `file://${stat.path}`;
  }
  return null;
};

const extractDetails = (
  blocks: {text: string}[],
): {sn: string | null; pin: string | null; pw: string | null} => {
  let sn, pin, pw;

  for (const block of blocks) {
    const snMatch = block.text.match(/SN:([^\n]+)/);
    const pinMatch = block.text.match(/PIN:([^\n]+)/);
    const pwMatch = block.text.match(/PW:\s*([^\n]+)/);

    if (snMatch) {
      sn = snMatch[1].trim();
    }
    if (pinMatch) {
      pin = pinMatch[1].trim();
    }
    if (pwMatch) {
      pw = pwMatch[1].replace(/\s+/g, '').trim();
    }
  }

  return {
    sn: sn ?? null,
    pin: pin ?? null,
    pw: pw ?? null,
  };
};

const OCRCamera: React.FC<OCRCameraProps> = ({onDetailsExtracted}) => {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [requestPermission, hasPermission]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const scan = async () => {
      if (!cameraRef.current || isProcessing || !scanning) {
        return;
      }

      try {
        setIsProcessing(true);
        setError(null);

        const photo = await cameraRef.current.takePhoto();
        if (!photo?.path) {
          throw new Error('Photo path is undefined');
        }

        const contentUri = await uriToContentUri(photo.path);
        const blocks = await MlkitOcr.detectFromFile(contentUri as string);

        const {sn, pin, pw} = extractDetails(blocks);
        const fullText = blocks.map(b => b.text).join('\n');

        if (sn && pin && pw) {
          setScanning(false);
          onDetailsExtracted({sn, pin, pw, fullText});
          if (interval) {
            clearInterval(interval);
          }
        }
      } catch (err: any) {
        setError(err.message || 'OCR failed');
      } finally {
        setIsProcessing(false);
      }
    };

    if (device && hasPermission && scanning) {
      interval = setInterval(scan, 1200);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [device, hasPermission, isProcessing, onDetailsExtracted, scanning]);

  if (!device || !hasPermission) {
    return (
      <View style={styles.centered}>
        <Text>Waiting for camera permission...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
      />
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color="white" size="large" />
          <Text style={styles.processingText}>Scanning...</Text>
        </View>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default OCRCamera;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
  },
  errorText: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    color: 'red',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 10,
    borderRadius: 6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
