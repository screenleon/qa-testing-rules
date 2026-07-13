// Semgrep fixture tests for qa-testing-rules C# rules.
using System.Threading;

class ExampleTests {
  void SleepBad() {
    // ruleid: qa-no-sleep-in-tests-csharp
    Thread.Sleep(100);
  }
}
