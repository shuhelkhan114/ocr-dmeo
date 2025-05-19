import React, {useState} from 'react';
import {Alert, Button, SafeAreaView} from 'react-native';

import OCR from './src/components/OCR';

function App(): React.JSX.Element {
  const [startScanning, setStartScanning] = useState(false);

  const handleDetailsExtracted = ({
    sn,
    pin,
    pw,
    fullText,
  }: {
    sn: string | null;
    pin: string | null;
    pw: string | null;
    fullText: string;
  }) => {
    Alert.alert('Extracted Info', `SN: ${sn}\nPIN: ${pin}\nPW: ${pw}`);
    console.log('Full OCR text:', fullText);
    setStartScanning(false);
  };

  return (
    <SafeAreaView style={{flex: 1}}>
      <Button
        style={{
          margin: 20,
          backgroundColor: 'blue',
          color: 'white',
          borderRadius: 10,
        }}
        title="Start Scanning"
        onPress={() => setStartScanning(true)}
      />

      {startScanning && <OCR onDetailsExtracted={handleDetailsExtracted} />}
    </SafeAreaView>
  );
}

export default App;
