import { SynthParamsProvider, useSynthParams } from "@/lib/stores/params";
import { LiveModeProvider, useLiveMode } from "@/lib/stores/liveMode";
import { NeoSynth } from "@/pages/NeoSynth";
import { LiveModeLayout } from "@/components/live/LiveModeLayout";

function AppInner() {
  const { params, setParams } = useSynthParams();
  const { isLiveMode } = useLiveMode();

  return isLiveMode ? (
    <LiveModeLayout />
  ) : (
    <NeoSynth />
  );
}

function App() {
  return (
    <SynthParamsProvider>
      <LiveModeProviderWrapper>
        <AppInner />
      </LiveModeProviderWrapper>
    </SynthParamsProvider>
  );
}

function LiveModeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { params, setParams } = useSynthParams();
  return (
    <LiveModeProvider synthParams={params} setSynthParams={setParams}>
      {children}
    </LiveModeProvider>
  );
}

export default App;
