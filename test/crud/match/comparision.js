/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var match = require('../../../lib/crud/match');


describe('#comparision operators - development', function() {


  describe('#primitive implicit $eq', function() {

    it('#same values', function() {
      it('# number with number', function() {
        expect(match( { value: 1 }, { value: 1 } )).eql(1===1);
      });
      it('# string with string', function() {
        expect(match( { value: 'ab' }, { value: 'ab' } )).eql('ab'==='ab');
      });
      it('# null with null', function() {
        expect(match( { value: null }, { value: null } )).eql(null===null);
      });
    });

    it('#different values', function() {
      it('# number with number', function() {
        expect(match( { value: 1 }, { value: 2 } )).eql(1===2);
      });
      it('# string with number', function() {
        expect(match( { value: 'ab' }, { value: 1 } )).eql('ab'===1);
      });
      it('# number with string', function() {
        expect(match( { value: 1 }, { value: 'ab' } )).eql(1==='ab');
      });
      it('# string with string', function() {
        expect(match( { value: 'ab' }, { value: 'cd' } )).eql('ab'==='cd');
      });
      it('# string with null', function() {
        expect(match( { value: 'ab' }, { value: null } )).eql('ab'===null);
      });
      it('# null with string', function() {
        expect(match( { value: null }, { value: 'ab' } )).eql(null==='cd');
      });
    });

  });

  describe('# several fields implicit $eq', function() {
    describe('#same values', function() {
      it('# number fields with number fields', function() {
        expect(match( { value1: 1, value2: 2 }, { value1: 1, value2: 2 } )).eql(true);
      });
      it('# string fields with string fields', function() {
        expect(match( { value1: 'ab', value2: 'cd' }, { value1: 'ab', value2: 'cd' } )).eql(true);
      });
      it('# number fields with null fields', function() {
        expect(match( { value1: null, value2: 2 }, { value1: null, value2: 2 } )).eql(true);
        expect(match( { value1: 1, value2: null }, { value1: 1, value2: null } )).eql(true);
      });
    });
    describe('#different values', function() {
      it('# number fields with null fields', function() {
        expect(match( { value1: null, value2: 2    }, { value1: 1,    value2: 2    } )).eql(false);
        expect(match( { value1: null, value2: 2    }, { value1: null, value2: 22   } )).eql(false);
        expect(match( { value1: 1,    value2: 2    }, { value1: null, value2: 2    } )).eql(false);
        expect(match( { value1: 1,    value2: null }, { value1: 1,    value2: 2    } )).eql(false);
        expect(match( { value1: 1,    value2: null }, { value1: 11,   value2: null } )).eql(false);
        expect(match( { value1: 1,    value2: 2    }, { value1: 1,    value2: null } )).eql(false);
      });
    });
  });


  describe('#primitive $eq', function() {

    it('#same values', function() {
      expect(match( { value: 'ab' }, { value: { $eq: 'ab' } } )).eql('ab'==='ab');
    });

    it('#different values', function() {
      expect(match( { value: 'ab' }, { value: { $eq: 'cd' } } )).eql('ab'==='cd');
    });

    describe('# null', function() {
      it('# same values', function() {
        expect(match( { value: null }, { value: { $eq: null } } )).eql(null===null);
      });
      it('# null with number', function() {
        expect(match( { value: null }, { value: { $eq: 1 } } )).eql(null===1);
      });
      it('# null with string', function() {
        expect(match( { value: null }, { value: { $eq: 'ab' } } )).eql(null==='ab');
      });
    });

  });


  describe('#primitive $ne', function() {

    it('#same values', function() {
      expect(match( { value: 'ab' }, { value: { $ne: 'ab' } } )).eql('ab'!=='ab');
    });

    it('#different values', function() {
      expect(match( { value: 'ab' }, { value: { $ne: 'cd' } } )).eql('ab'!=='cd');
    });

    describe('# null', function() {
      it('# same values', function() {
        expect(match( { value: null }, { value: { $ne: null } } )).eql(null!==null);
      });
      it('# null with number', function() {
        expect(match( { value: null }, { value: { $ne: 1 } } )).eql(null!==1);
      });
      it('# null with string', function() {
        expect(match( { value: null }, { value: { $ne: 'ab' } } )).eql(null!=='ab');
      });
    });

  });


  describe('#primitive $gt', function() {

    describe('# greater', function() {
      it('# numbers', function() {
        expect(match( { value: 1 }, { value: { $gt: 0 } } )).eql(1>0);
      });
      it('# strings', function() {
        expect(match( { value: 'cd' }, { value: { $gt: 'ab' } } )).eql('cd'>'ab');
      });
    });

    describe('# equal', function() {
      it('# numbers', function() {
        expect(match( { value: 1 }, { value: { $gt: 1 } } )).eql(1>1);
      });
      it('# strings', function() {
        expect(match( { value: 'ab' }, { value: { $gt: 'ab' } } )).eql('ab'>'ab');
      });
    });

    describe('# less', function() {
      it('# numbers', function() {
        expect(match( { value: 1 }, { value: { $gt: 2 } } )).eql(1>2);
      });
      it('# strings', function() {
        expect(match( { value: 'ab' }, { value: { $gt: 'cd' } } )).eql('ab'>'cd');
      });
    });

    describe('# null', function() {
      it('# null with number', function() {
        expect(match( { value: null }, { value: { $gt: 1 } } )).eql(null>1);
      });
      it('# null with string', function() {
        expect(match( { value: null }, { value: { $gt: 'ab' } } )).eql(null>'ab');
      });
    });

  });


  describe('#primitive $gte', function() {

    describe('# numbers', function() {
      it('#greater', function() {
        expect(match( { value: 1 }, { value: { $gte: 0 } } )).eql(1>=0);
      });
      it('#equal', function() {
        expect(match( { value: 1 }, { value: { $gte: 1 } } )).eql(1>=1);
      });
      it('#less', function() {
        expect(match( { value: 1 }, { value: { $gte: 2 } } )).eql(1>=2);
      });
    });

    describe('# null', function() {
      it('# null with number', function() {
        expect(match( { value: null }, { value: { $gte: 1 } } )).eql(null>=1);
      });
      it('# null with string', function() {
        expect(match( { value: null }, { value: { $gte: 'ab' } } )).eql(null>='ab');
      });
    });

  });


  describe('# $lt', function() {

    describe('# primitive', function() {

      describe('# greater', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lt: 0 } } )).eql( 1<0 );
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lt: 'aa' } } )).eql('ab'<'aa');
        });
      });

      describe('# equal', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lt: 1 } } )).eql(1<1);
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lt: 'ab' } } )).eql('ab'<'ab');
        });
      });

      describe('# less', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lt: 2 } } )).eql( 1<2 );
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lt: 'ac' } } )).eql( 'ab' < 'cd' );
        });
      });

      describe('# null', function() {
        it('# null with number', function() {
          expect(match( { value: null }, { value: { $lt: 1 } } )).eql( null < 1 );
        });
        it('# null with string', function() {
          expect(match( { value: null }, { value: { $lt: 'ab' } } )).eql( null < 'ab' );
        });
      });

    });
  });


  describe('# $lte', function() {
    describe('# primitive', function() {

      describe('# greater', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lte: 0 } } )).eql(1<=0);
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lte: 'aa' } } )).eql('ab'<='aa');
        });
      });

      describe('# equal', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lte: 1 } } )).eql(1<=1);
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lte: 'ab' } } )).eql('ab'<='ab');
        });
      });

      describe('# less', function() {
        it('# numbers', function() {
          expect(match( { value: 1 }, { value: { $lte: 2 } } )).eql(1<=2);
        });
        it('# strings', function() {
          expect(match( { value: 'ab' }, { value: { $lte: 'ac' } } )).eql('ab'<='ac');
        });
      });

    });

    describe('# compound field', function() {

      describe('# greater', function() {
        it('# numbers', function() {
          expect(match( { a: { b: 1 } }, { 'a.b': { $lte: 0 } } )).eql(false);
        });
      });

      describe('# equal', function() {
        it('# numbers', function() {
          expect(match( { a: { b: 1 } }, { 'a.b': { $lte: 1 } } )).eql(true);
        });
      });

      describe('# less', function() {
        it('# numbers', function() {
          expect(match( { a: { b: 1 } }, { 'a.b': { $lte: 2 } } )).eql(true);
        });
      });

    });
  });


  describe('#primitive $in', function() {

    it('#first', function() {
      expect(match( { value: 'ab' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(true);
    });

    it('#second', function() {
      expect(match( { value: 'cd' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(true);
    });

    it('#none', function() {
      expect(match( { value: 'de' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(false);
    });

  });


  describe('#primitive $in', function() {

    it('#first', function() {
      expect(match( { value: 'ab' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(false);
    });

    it('#second', function() {
      expect(match( { value: 'cd' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(false);
    });

    it('#none', function() {
      expect(match( { value: 'de' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(true);
    });

  });


});
