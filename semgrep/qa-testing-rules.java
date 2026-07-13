// Semgrep fixture tests for qa-testing-rules Java rules.

import org.junit.jupiter.api.Disabled;

class ExampleTest {
  void sleepBad() throws Exception {
    // ruleid: qa-no-sleep-in-tests-java
    Thread.sleep(100);
  }

  // ruleid: qa-no-disabled-tests-java
  @Disabled
  void disabledBad() {}
}
