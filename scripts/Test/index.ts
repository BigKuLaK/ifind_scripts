import 'path';
import 'colors';

export default class Test {
  static test?: TaskEntity;

  init() {
    console.log('TEST'.bold);
  }
}

const test = new Test;
test.init();
