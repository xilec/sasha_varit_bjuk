if (this["document"]) {
    // TODO remove after debug
    document.body.style.border = "5px solid red";


    let cartlist = document.querySelector("div[class='cartlist']");
    cartlist.insertAdjacentHTML("afterbegin", `
<!-- TODO uncomment after debug-->
<!--<details>-->
<!--    <summary class="cartlist_header">-->
<!--        БЖУ-->
<!--    </summary>-->
    <div>
        <div>
            БЖУ + Энергетическая ценность
        </div>
    </div>
<!--</details>-->
`);

    let bju = parseMenuBju();
}

function parseBjuValue(text) {
    // text: 'Белки: 17'
    let split_res = text.split(': ');
    return Number(split_res[1]);
}

function parseCalorie(text) {
    // text: '295 ккал'
    let split_res = text.split(' ');
    return Number(split_res[0]);
}

function parseWeight(input) {
    // variants: 
    // null
    // '100 г. '
    // '150/180 г. '
    // '25/10/225 г. '
    // '(цена за 100 г.) ' 

    if (!input) {
        return null;
    }

    let text = String(input);

    let resi = text.indexOf(' г.');
    if (resi < 0) {
        return null;
    }

    let text1 = text.split(' г.')[0];

    let startsWithRes = text1.startsWith('(цена за ');
    if (startsWithRes) {
        let split_res = text1.split('(цена за ');
        return parseInt(split_res[1]);
    }

    let res3 = text1.split('/')
    if (res3.some) {
        return res3.reduce((acc, cur) => parseInt(cur) + acc, 0);
    }


    return null;
}

function parseBju(elementBju) {
    if (elementBju) {
        let bju_cols = Array.from(elementBju.querySelectorAll("div[class='dish_bgu_line']")).map(x => x.innerText);

        return {
            protein: parseBjuValue(bju_cols[0]),
            fat: parseBjuValue(bju_cols[1]),
            carbs:parseBjuValue(bju_cols[2]),
            calorie:parseCalorie(bju_cols[3]),
        }
    } else {
        return null;
    }
}

function parseMenuItem(menuItem) {
    let name = String(menuItem.querySelector("div[class='dish__name disp']").innerText);
    let elementBju = menuItem.querySelector("div[class='dish_bgu']");
    let bju = parseBju(elementBju);

    let weight = parseWeight(menuItem.querySelector("div[class='dish__weight']").innerText);

    return {
        name: name,
        bju: bju,
        weight: weight,
    }
}

function parseMenuBju() {
    return Array.from(document.querySelectorAll("div[class='menulistItem__info']")).map(x => parseMenuItem(x))
}

module.exports = {
    parseWeight: function (input) {
        return parseWeight(input);
    }
}
