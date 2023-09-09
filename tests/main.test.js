const main = require('../src/main');

describe('testing parseWeight', () => {
    it.each([
        ['abcd', null],
        ['100 г. ', 100],
        ['150/180 г. ', 330],
        ['(цена за 110 г.) ', 110],
    ])('parse weight %p must be %p', (input, result) => {
        expect(main.parseWeight(input)).toEqual(result);
    });
})