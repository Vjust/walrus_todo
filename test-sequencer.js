const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const copyTests = Array.from(tests);
    return copyTests.sort((testA, testB) => {
      const isIntegration = test => test.path.includes('integration');
      if (isIntegration(testA) !== isIntegration(testB)) {
        return isIntegration(testA) ? 1 : -1;
      }
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;
