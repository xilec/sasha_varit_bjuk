const main = require('../src/main');

describe('parseWeight', () => {
    it.each([
        [null, null],
        ['', null],
        ['abcd', null],
        ['100 г. ', 100],
        ['150/180 г. ', 330],
        ['150/120/50 г.', 320],
        ['~1000 г. ', 1000],
        ['(цена за 110 г.) ', 110],
    ])('parse weight %p must be %p', (input, result) => {
        expect(main.parseWeight(input)).toEqual(result);
    });
})

test('parseBjuValue', () => {
    expect(main.parseBjuValue('Белки: 17')).toBe(17);
})

test('parseCalorie', () => {
    expect(main.parseCalorie('295 ккал')).toBe(295);
})