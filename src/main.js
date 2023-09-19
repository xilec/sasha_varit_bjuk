// html elements
let bjukLbl;

// shared state
let bjukMap;
let cartList;

function emptyBjuk() {
    return new Bjuk(0, 0, 0, 0);
}

class Bjuk {
    protein = 0;
    fat = 0;
    carbs = 0;
    calorie = 0;
    
    constructor(protein, fat, carbs, calorie) {
        this.protein = protein;
        this.fat = fat;
        this.carbs = carbs;
        this.calorie = calorie;
    }
    
    add(val) {
        if (!(val instanceof Bjuk)) {
            throw 'Invalid type. "val" must be Bjuk';
        }

        return new Bjuk(this.protein + val.protein, this.fat + val.fat, this.carbs + val.carbs, this.calorie + val.calorie);
    }
    
    mult(val) {
        if (typeof val !== 'number') {
            throw 'Invalid type. "val" must be Number'
        }
        
        return new Bjuk(val * this.protein, val * this.fat, val * this.carbs, val * this.calorie);
    }
}

function parseBjukValue(text) {
    let split_res = text.split(': ');
    return Number(split_res[1]);
}

function parseCalorie(text) {
    let split_res = text.split(' ');
    return Number(split_res[0]);
}

function parseWeight(input) {
    if (!input) {
        return null;
    }

    let text = String(input);

    const suffix = 'г.';
    let resi = text.indexOf(suffix);
    if (resi < 0) {
        return null;
    }

    // split pattern without space char and after call `trimEnd()`
    // because we can receive space char with another code point from the page
    let part1 = text.split(suffix)[0].trimEnd();

    if (part1.startsWith('~')) {
        return parseFloat(part1.slice(1));
    }

    const prefix = '(цена за ';
    let startsWithRes = part1.startsWith(prefix);
    if (startsWithRes) {
        let split_res = part1.split(prefix);
        return parseFloat(split_res[1]);
    }

    let res3 = part1.split('/')
    if (res3.some) {
        return Number(res3.reduce((acc, cur) => parseFloat(cur) + acc, 0));
    }

    return null;
}

function parseBjuk(elementBju) {
    if (elementBju) {
        let bju_cols = Array.from(elementBju.querySelectorAll("div[class='dish_bgu_line']")).map(x => x.innerText);

        return new Bjuk(
            parseBjukValue(bju_cols[0]),
            parseBjukValue(bju_cols[1]),
            parseBjukValue(bju_cols[2]),
            parseCalorie(bju_cols[3]),
        );
    } else {
        return null;
    }
}

function parseMenuItem(menuItem) {
    return {
        name: String(menuItem.querySelector("div[class='dish__name disp']").innerText),
        bjuk: parseBjuk(menuItem.querySelector("div[class='dish_bgu']")),
        weight: parseWeight(menuItem.querySelector("div[class='dish__weight']").innerText),
    }
}

const parseMenuBjuk = bjuElements => new Map(Array.from(bjuElements).map(x => {
    let bjukItem = parseMenuItem(x);
    return [bjukItem.name, bjukItem]
}));

function parseCardPriceCount(cartItemElement, partSuffix) {
    const cartlist = cartItemElement.querySelector(`div[class='cartlist_${partSuffix}']`);
    if (!cartlist) {
        return null;
    }

    const cartlist_name_class = `cartlist_${partSuffix}name`;
    const cartlist_name = cartlist.querySelector(`.${cartlist_name_class}`);
    if (!cartlist_name) {
        console.error(`Not found node with class ${cartlist_name_class}`);
        return null;
    }
    
    const cartlist_price_class = 'cartlist_price';
    const cartlist_price = cartlist.querySelector(`.${cartlist_price_class}`);
    if (!cartlist_price) {
        console.error(`Not found node with class ${cartlist_price_class}`);
        return null;
    }
    const cartlist_value_class = 'cartlist_value';
    const cartlist_value = cartlist.querySelector(`.${cartlist_value_class}`);
    if (!cartlist_value) {
        console.error(`Not found node with class ${cartlist_value_class}`);
    }

    // skip class 'dishIsMissing'
    const is_missing = cartlist_name.classList.contains('dishIsMissing');
    return {
        name: String(cartlist_name.innerText),
        price: Number(cartlist_price.innerText),
        count: parseInt(cartlist_value.innerText),
        is_missing,
        need_skip: is_missing,
    }
}

function parseCartItem(cartItemElement) {
    let totalElement = cartItemElement.querySelector("div[class='cartlist_total']");

    const second = parseCardPriceCount(cartItemElement, "second");
    const portionsElement = totalElement.querySelector("div[class='cartlist_value']");
    
    let portions = portionsElement && !portionsElement.isHidden
        ? Number(portionsElement.innerText)
        : Number.NaN;
    
    portions = portions === 0 ? Number.NaN : portions;
    return {
        main: parseCardPriceCount(cartItemElement, "main"),
        second,
        portions,
        totalPrice: Number(totalElement.querySelector("div[class='cartlist_totalvalue']").innerText),
    };
}

function parseCardList(cartItemElements) {
    return Array.from(cartItemElements).map(x => parseCartItem(x));
}

function calculateBjukTotalSum(bjukList, cartList) {
    return cartList.reduce((acc, item) => {
        let bjukItem = getItemBjukSum(bjukList, item);

        return {
            bjuk: acc.bjuk.add(bjukItem.bjuk),
            completed: acc.completed & bjukItem.completed,
        };
    }, {bjuk: emptyBjuk(), completed: true});
}

function getItemBjukSum(bjukList, cartItem) {
    const res = {
        bjuk: emptyBjuk(),
        completed: false, // some part of needed description os absent on page
    };

    if (!tryAddBjukToCartItem(bjukList, cartItem.main, 'main', res)) {
        return res;
    }

    const secondPart = cartItem.second;
    // second part is optional
    if (secondPart) {
        if (!tryAddBjukToCartItem(bjukList, secondPart, 'second', res)) {
            return res;
        }
    }

    let portions = Number.isNaN(cartItem.portions) ? 1 : cartItem.portions;
    res.bjuk = res.bjuk.mult(portions);

    res.completed = true;

    return res
}

function tryAddBjukToCartItem(bjukList, cartPart, partDescription, res) {
    let bjukPart = bjukList.get(cartPart.name);
    if (cartPart.need_skip) {
        return true;
    }
    
    if (!bjukPart) {
        console.error(`Not found bjuk for ${partDescription} part ${cartPart.name}`);
        return res;
    }

    if (!bjukPart.bjuk || !bjukPart.weight) {
        return false;
    }

    // bjuk specified by 100 gr
    res.bjuk = res.bjuk.add(bjukPart.bjuk.mult(cartPart.count * bjukPart.weight / 100))

    return true;
}

function toBjukShortString(bjukList, cartList) {
    if (!cartList.length) {
        return 'Б: - Ж: - У: - К: -'
    }

    let bjukRes = calculateBjukTotalSum(bjukList, cartList);

    const completedSign = bjukRes.completed ? '' : '+';
    const bjuk = bjukRes.bjuk;
    return `Б: ${bjuk.protein.toFixed(1)}${completedSign}\tЖ: ${bjuk.fat.toFixed(1)}${completedSign}\tУ: ${bjuk.carbs.toFixed(1)}${completedSign}\tК: ${bjuk.calorie.toFixed(1)}${completedSign}`; 
}

function toOrderListString(cartList, totalSum) {
    return !cartList.length
    ? `Ничего не заказано`
    : cartList.map(x =>
        !x.second
            ? Number.isNaN(x.portions)
                ? `- ${x.main.count} X ${x.main.name}`
                : `- ${x.main.count} X (порции) ${x.portions} ${x.main.name}`
            : `- В один контейнер (порции) ${x.portions} X ⤵\n\t- ${x.main.count} X ${x.main.name}\n\t- ${x.second.count} X ${x.second.name}`).join('\n') + `\nСумма: ${totalSum}p`;
}


const recalucationBjukList = () => {
    bjukMap = parseMenuBjuk(document.querySelectorAll("div[class='menulistItem__info']"));
}

const checkMenuContainsAllItems = cartList => {
    const checkMenuPart = part => {
        return !part.need_skip && !!bjukMap.get(part.name);
    };

    return cartList.every(x => checkMenuPart(x.main) && (!x.second || checkMenuPart(x.second)))
}

const updateBjukLbl = () => {
    const cartlist = parseCardList(document.querySelectorAll("div[class='cartlist_item']"));
    cartList = cartlist;
    if (!checkMenuContainsAllItems(cartlist)) {
        recalucationBjukList();
    }
    bjukLbl.innerText = toBjukShortString(bjukMap, cartlist);
};

function addedBjukDetailsDialog(bjuk_details_id) {
    const dialog_id = 'bjuk_dialog';
    const details_table_id = 'detials_table';
    document.body.insertAdjacentHTML('beforeend', `
<dialog id="${dialog_id}">
    <div>
        <table id="${details_table_id}">
            <caption>БЖУК детали</caption>
            <tr>
                <th>Название</th>
                <th>Кол-во, шт</th>
                <th>Вес, гр</th>
                <th>Белки, гр</th>
                <th>Жиры, гр</th>
                <th>Углеводы, гр</th>
                <th>Эн. цен., ккал</th>
            </tr>
        </table>
    </div>
    <button type="button" style="float:right" onclick="window.${dialog_id}.close();">Закрыть</button>
</dialog>
`)

    let details = document.getElementById(bjuk_details_id);
    details.addEventListener('click', () => {
        const table = document.getElementById(details_table_id);

        const valStr = (val, sum, isSumExists) => {
            if (!val && val !== 0) {
                return '-';
            }

            return `${val.toFixed(1)}${isSumExists ? ` (${sum.toFixed(1)})` : ''}`;
        };

        const addRow = (table, bjukMap, cartItem, cartPart, partDescription, isComplex) => {
            let bjukPart = bjukMap.get(cartPart.name);
            if (!cartPart.need_skip && !bjukPart) {
                console.error(`Not found bjuk for ${partDescription} part ${cartItem.name}`);
            }

            let portions = Number.isNaN(cartItem.portions) ? 1 : cartItem.portions;
            let wk = cartPart.count * portions * bjukPart?.weight / 100;

            let sum = {
                bjuk: emptyBjuk(),
                completed: false,
            };
            let isSum = bjukPart ? tryAddBjukToCartItem(bjukMap, cartPart, partDescription, sum) : false;
            sum.bjuk = sum.bjuk.mult(portions);

            table.insertRow().insertAdjacentHTML('beforeend', `
                <td style="${isComplex ? 'padding-left:20px' : ''}">${cartPart.name}</td>
                <td>${cartPart.count}${Number.isNaN(cartItem.portions) ? '' : ` (${cartPart.count * cartItem.portions})`}</td>
                <td>${valStr(bjukPart?.weight, wk, wk !== null)}</td>
                <td>${valStr(bjukPart?.bjuk?.protein, sum?.bjuk?.protein, isSum)}</td>
                <td>${valStr(bjukPart?.bjuk?.fat, sum?.bjuk?.fat, isSum)}</td>
                <td>${valStr(bjukPart?.bjuk?.carbs, sum?.bjuk?.carbs, isSum)}</td>
                <td>${valStr(bjukPart?.bjuk?.calorie, sum?.bjuk?.calorie, isSum)}</td>
            `)
        }

        // clear old rows
        // not removing row with headers
        Array.from(table.rows).slice(1).map(x => x.remove());

        cartList.forEach(cartItem => {
            const mainPart = cartItem.main;
            const secondPart = cartItem.second;

            if (!secondPart) {
                // single
                addRow(table, bjukMap, cartItem, mainPart, 'main', false);
            } else {
                // composite
                // in this case portions there is all always
                table.insertRow().insertAdjacentHTML('beforeend', `<td colspan="7">В один контейнер (порции) X ${cartItem.portions}</td>`)

                addRow(table, bjukMap, cartItem, mainPart, 'main', true);
                addRow(table, bjukMap, cartItem, secondPart, 'second', true);
            }
        });

        let res = calculateBjukTotalSum(bjukMap, cartList);

        table.insertRow().insertAdjacentHTML('beforeend', `
        <td style="font-weight: bold">Cумма</td>
                    <td></td>
                    <td></td>
                    <td>${res.bjuk.protein.toFixed(1)}</td>
                    <td>${res.bjuk.fat.toFixed(1)}</td>
                    <td>${res.bjuk.carbs.toFixed(1)}</td>
                    <td>${res.bjuk.calorie.toFixed(1)}</td>
        `)

        document.getElementById(dialog_id).showModal();
    });
}

// to not run script in tests
if (this["document"]) {
    const bjuk_div_id = 'bjuk_div';
    const bjuk_lbl_id = 'bjuk_lbl';
    const bjuk_details_id = 'bjuk_details';
    const bjuk_order_id = 'bjuk_order';

    // add Elements to show calculated proteins, fat, carbs and calories
    let bjuk_div = document.getElementById(bjuk_div_id);
    if (bjuk_div) {
        bjuk_div.remove();
    }
    let cartlist_footer = document.querySelector('div[class="cartlist_footer"]');
    cartlist_footer.insertAdjacentHTML('afterbegin', `
        <div id=${bjuk_div_id} class="cartlist_footer_div" style="float: left">
            <div id="${bjuk_lbl_id}" class="cartlist_footer_div" style="float: left;border-top: none;">Б:----- Ж:----- У:----- К:-----  </div>
            <button id="${bjuk_details_id}" type="button" style="margin-right: 20px;" >Детально</button>
            <button id="${bjuk_order_id}" type="button" >Список</button>
        </div>
    `);
    bjukLbl = document.getElementById(bjuk_lbl_id);

    // show order in text form
    let show_order = document.getElementById(bjuk_order_id);
    const totalSumElement = document.getElementById('cartlist_totalsum');
    show_order.addEventListener('click', async () => {
        const orderStr = toOrderListString(cartList, totalSumElement.innerText);
        await navigator.clipboard.writeText(orderStr);
        alert(orderStr);
    });

    const observerConfig = {attributes: true, childList:true, subtree: true};

    // handle changing order
    const totalSumObserver = new MutationObserver(() => {
        updateBjukLbl();
    });
    totalSumObserver.observe(totalSumElement, {attributes: false, childList:true, subtree: false});

    // detection of changing selected day
    const menuBarObserver = new MutationObserver(() => {
        totalSumObserver.disconnect();
        
        setTimeout(() => {
            // update menu after changing current day
            recalucationBjukList();
            updateBjukLbl();

            totalSumObserver.observe(totalSumElement, {attributes: false, childList:true, subtree: false});
        }, 700)
    })
    menuBarObserver.observe(document.querySelector('div[class="menubar__slider"]'), observerConfig);
    
   
    addedBjukDetailsDialog(bjuk_details_id);

    // calculation of initial state
    recalucationBjukList();
    updateBjukLbl();
}

// otherwise browser write error that module is not defined, but it's needed for tests
if (!this["document"]) {
    module.exports = {
        parseWeight: input => parseWeight(input),
        parseBjuValue: input => parseBjukValue(input),
        parseCalorie: input => parseCalorie(input),
    }
}
