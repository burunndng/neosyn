import { SynthParamsProvider } from "@/lib/stores/params";
import { NeoSynth } from "@/pages/NeoSynth";

function App() {
  return (
    <SynthParamsProvider>
      <NeoSynth />
    </SynthParamsProvider>
  );
}

export default App;
