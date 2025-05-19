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
import TextRecognition from '@react-native-ml-kit/text-recognition';
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
  return filePath;
};

const extractDetails = (
  lines: string[],
): {sn: string | null; pin: string | null; pw: string | null} => {
  let sn = null,
    pin = null,
    pw = null;

  for (const line of lines) {
    const snMatch = line.match(/SN:([^\n]+)/);
    const pinMatch = line.match(/PIN:([^\n]+)/);
    const pwMatch = line.match(/PW:\s*([^\n]+)/);

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

  return {sn, pin, pw};
};

const OCR: React.FC<OCRCameraProps> = ({onDetailsExtracted}) => {
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

        const photo = await cameraRef.current.takePhoto({
          enableShutterSound: false,
        });
        if (!photo?.path) {
          throw new Error('Photo path is undefined');
        }

        const contentUri = await uriToContentUri(photo.path);
        console.log('Photo path:', contentUri);

        // OCR using @react-native-ml-kit/text-recognition
        // This returns an array of blocks, each block has a `text` property
        const blocks = await TextRecognition.recognize(contentUri as string);

        console.log('Blocks:', blocks);

        // Extract the text from blocks
        const lines = blocks.blocks.map(block => block.text);

        const {sn, pin, pw} = extractDetails(lines);
        const fullText = lines.join('\n');

        if (sn && pin && pw) {
          setScanning(false);
          onDetailsExtracted({sn, pin, pw, fullText});
          if (interval) {
            clearInterval(interval);
          }
        }
      } catch (err: any) {
        console.log('Error during OCR:', err);
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

export default OCR;

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
