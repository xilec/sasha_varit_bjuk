// html elements
let bjukLbl;

// shared state
let bjukList;
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
    let cartlist = cartItemElement.querySelector(`div[class='cartlist_${partSuffix}']`);
    if (!cartlist) {
        return null;
    }

    return {
        name: String(cartlist.querySelector(`div[class='cartlist_${partSuffix}name']`).innerText),
        price: Number(cartlist.querySelector(`div[class='cartlist_price']`).innerText),
        count: parseInt(cartlist.querySelector(`div[class='cartlist_value']`).innerText),
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

    const mainPart = cartItem.main;
    let mainBjukPart = bjukList.get(mainPart.name);
    if (!mainBjukPart) {
        console.error(`Not found bjuk for main part ${mainPart.name}`);
        return res;
    }
    
    if (!tryAddBjukToCartItem(mainBjukPart, mainPart.count, mainBjukPart.weight, res)) {
        return res;
    }

    let portions = Number.isNaN(cartItem.portions) ? 1 : cartItem.portions;
    const secondPart = cartItem.second;
    if (!secondPart) {
        res.bjuk = res.bjuk.mult(portions);

        // for main part there is all needed definitions
        res.completed = true;

        return res;
    }
    
    let secondBjukPart = bjukList.get(secondPart.name);
    // second part is optional
    if (!secondBjukPart) {
        console.error(`Not found bjuk for second part ${mainPart.name}`);
        return res;
    } else if (!tryAddBjukToCartItem(secondBjukPart, secondPart.count, secondBjukPart.weight, res)) {
        return res;
    }
    res.bjuk = res.bjuk.mult(portions);

    res.completed = true;

    return res
}

function tryAddBjukToCartItem(bjukPart, count, weight, res) {
    if (!bjukPart.bjuk || !bjukPart.weight) {
        return false;
    }

    // bjuk specified by 100 gr
    res.bjuk = res.bjuk.add(bjukPart.bjuk.mult(weight / 100 * count))
    
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
            : `- (порции) ${x.portions} X ⤵\n\t- ${x.main.count} X ${x.main.name}\n\t- ${x.second.count} X ${x.second.name}`).join('\n') + `\nСумма: ${totalSum}p`;
}


let recalucationBjukList = () => {
    bjukList = parseMenuBjuk(document.querySelectorAll("div[class='menulistItem__info']"));
}

function updateBjukLbl() {
    bjukLbl.innerText = toBjukShortString(bjukList, cartList);
}

function recalculateCartList() {
    cartList = parseCardList(document.querySelectorAll("div[class='cartlist_item']"));
}

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
        let table = document.getElementById(details_table_id);

        const valStr = (val, sum, isSumExists) => {
            if (!val) {
                return '-';
            }

            return `${val.toFixed(1)} (${isSumExists ? sum.toFixed(1) : ''}) `;
        };

        const addRow = (table, bjukPart, part, cartItem, isComplex) => {
            let totalCount = Number.isNaN(cartItem.portions) ? part.count : part.count * cartItem.portions;
            let wk = bjukPart?.weight / 100 * totalCount;

            let sum = {
                bjuk: emptyBjuk(),
                completed: false,
            };
            let isSum = bjukPart ? tryAddBjukToCartItem(bjukPart, totalCount, bjukPart.weight, sum) : false;

            table.insertRow().insertAdjacentHTML('beforeend', `
                <td style="${isComplex ? 'padding-left:20px' : ''}">${part.name}</td>
                <td>${part.count}${Number.isNaN(cartItem.portions) ? '' : ` (${part.count * cartItem.portions})`}</td>
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

        cartList.forEach(x => {
            const mainPart = x.main;
            const secondPart = x.second;

            let mainBjukPart = bjukList.get(mainPart.name);

            if (!secondPart) {
                // single
                if (!mainBjukPart) {
                    console.error(`Not found bjuk for main part ${mainPart.name}`);
                }

                addRow(table, mainBjukPart, mainPart, x, false);
            } else {
                // composite
                // in this case portions there is all always
                table.insertRow().insertAdjacentHTML('beforeend', `<td colspan="7">Порции ${x.portions}</td>`)

                if (!mainBjukPart) {
                    console.error(`Not found bjuk for main part ${mainPart.name}`);
                }

                let secondBjukPart = bjukList.get(secondPart.name);
                if (!secondBjukPart) {
                    console.error(`Not found bjuk for main part ${mainPart.name}`);
                }

                addRow(table, mainBjukPart, mainPart, x, true);
                addRow(table, secondBjukPart, secondPart, x, true);
            }
        });

        let res = calculateBjukTotalSum(bjukList, cartList);

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

class SwitchPageWaiter {
    hasChanges = false;
    finishedCallback = null;     
    
    constructor(finishedCallback) {
        this.finishedCallback = finishedCallback;
    }    
    markHasChanges() {
        this.hasChanges = true;
    }
    
    startWaiting() {
        setTimeout(() => {
            if (this.hasChanges) {
                this.hasChanges = false;
                this.startWaiting()
            } else {
                this.finishedCallback?.();
            }
        }, 400);
    }
}

// to not run script in tests
if (this["document"]) {
    const bjuk_div_id = 'bjuk_div';
    const bjuk_lbl_id = 'bjuk_lbl';
    const bjuk_details_id = 'bjuk_details';
    const bjuk_order_id = 'bjuk_order';

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

    let show_order = document.getElementById(bjuk_order_id);
    const totalSumElement = document.getElementById('cartlist_totalsum');
    show_order.addEventListener('click', async () => {
        const orderStr = toOrderListString(cartList, totalSumElement.innerText);
        await navigator.clipboard.writeText(orderStr);
        alert(orderStr);
    })

    const observerConfig = {attributes: true, childList:true, subtree: true};

    const totalSumObserver = new MutationObserver(() => {
        recalculateCartList();
        updateBjukLbl();
    });
    totalSumObserver.observe(totalSumElement, {attributes: false, childList:true, subtree: false});

    const menu_list_id = 'list_snack_d';
    const menuListObserver = new MutationObserver(e => {
        e.forEach(x => {
            if (x.target.classList.contains('menulistItem') && x.type === 'attributes') {
                switchPageWaiter.markHasChanges();
            }
        });
    });

    const switchPageWaiter = new SwitchPageWaiter(() => {
        recalucationBjukList();
        recalculateCartList();
        updateBjukLbl();

        menuListObserver.observe(document.getElementById(menu_list_id), observerConfig);
        totalSumObserver.observe(totalSumElement, {attributes: false, childList:true, subtree: false});
    });
    
    const menuBarObserver = new MutationObserver(() => {
        menuListObserver.disconnect();
        totalSumObserver.disconnect();
        
        switchPageWaiter.startWaiting();
    })
    menuBarObserver.observe(document.querySelector('div[class="menubar__slider"]'), observerConfig);
    
   
    addedBjukDetailsDialog(bjuk_details_id);

    recalucationBjukList();
    recalculateCartList();
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
