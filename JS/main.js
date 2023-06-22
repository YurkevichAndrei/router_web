document.addEventListener('DOMContentLoaded',function (){
    let cont = 0;
    const sendMessageButton = document.querySelector('[name = send_message_button]');
    const clearButton = document.querySelector('[name = clear_button]');
    let tab = document.getElementById("tab");

    function appendCoord(coordinate) {
        let row;
        if(cont === 0)
        {
            tab.deleteRow(1)
        }
        row = document.createElement("tr");
        for (let i = 0; i < 3; i++)
        {
            let textNum;
            switch (i) {
                case 0:
                    textNum = document.createTextNode((cont+1).toString());
                    break;

                case 1:
                    textNum = document.createTextNode(coordinate[1].toFixed(5).toString());
                    break;

                case 2:
                    textNum = document.createTextNode(coordinate[0].toFixed(5).toString());
                    break;

                default:
                    textNum = document.createTextNode('-');
                    break;
            }

            let cell = document.createElement("td");
            cell.appendChild(textNum);
            row.appendChild(cell);
        }
        tblBody.appendChild(row);
        tab.appendChild(tblBody);
        cont++;
    }

    const header = '<tr><th>№</th><th>Lat</th><th>Lon</th></tr>';
    let tblBody = document.createElement("tbody");
    tblBody.id = 'tabbody'

    function creatTable() {
        let row = document.createElement("tr");
        row.id = 'row0'
        for (let i = 0; i < 3; i++)
        {
            let cell = document.createElement("td");
            let cellText = document.createTextNode('-');
            cell.id = 'cell'.concat(i.toString())
            cell.appendChild(cellText);
            row.appendChild(cell);
        }

        tblBody.appendChild(row);

        tab.innerHTML = header;
        tab.appendChild(tblBody);
    }
    creatTable();

    const sourceV = new ol.source.Vector();
    const vector = new ol.layer.Vector({
        source: sourceV,
        style: {
            'fill-color': 'rgb(0,253,71)',
            'stroke-color': '#337aff',
            'stroke-width': 2,
            'circle-radius': 3,
            'circle-fill-color': '#0040cb',
        },
    });

    let point;
    let vectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
    });

    let layer = new ol.layer.Vector({
        source: vectorSource,
        style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'red',
                    width: 5,
                }),
        }),
    });

    let map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            layer,
            vector
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat( [37.543512029888376, 55.55416397989403]),
            zoom: 8,
        }),
    });

    let draw, snap;

    function addInteractions() {
        draw = new ol.interaction.Draw({
            source: sourceV,
            type: 'Point'
        })
        map.addInteraction(draw);
        snap = new ol.interaction.Snap({source: sourceV});
        map.addInteraction(snap);
    }
    addInteractions();
    ol.proj.useGeographic();

    const element = document.getElementById('popup');
    const popup = new ol.Overlay({
        element: element,
        stopEvent: false,
    });
    map.addOverlay(popup);

    function formatCoordinate(coordinate) {
        point = new ol.geom.Point([coordinate[0],coordinate[1]]);
        return `
        <table>
          <tbody>
            <tr><th>lon</th><td>${coordinate[0].toFixed(5)}</td></tr>
            <tr><th>lat</th><td>${coordinate[1].toFixed(5)}</td></tr>
          </tbody>
        </table>`;
    }

    let coords = "";
    function messageCoordinate(coordinate) {
        coords = coords.concat(coordinate[0]);
        coords = coords.concat(":");
        coords = coords.concat(coordinate[1]);
        coords = coords.concat("=>")
    }

    let popover;
    map.on('click', function (event) {
        if (popover) {
            popover.dispose();
            popover = undefined;
        }
        const feature = map.getFeaturesAtPixel(event.pixel)[0];
        if (!feature) {
            return;
        }
        const coordinate = feature.getGeometry().getCoordinates();
        popup.setPosition([
            coordinate[0] + Math.round(event.coordinate[0] / 360) * 360,
            coordinate[1],
        ]);

        popover = new bootstrap.Popover(element, {
            container: element.parentElement,
            content: formatCoordinate(coordinate),
            html: true,
            offset: [0, 5],
            placement: 'right',
            sanitize: false
        });
        messageCoordinate(coordinate);
        popover.show();
        appendCoord(coordinate);
    });

    let websocketClient = new WebSocket("ws://localhost:12345");

    websocketClient.onopen = () =>{
        sendMessageButton.onclick = () => {
            const rowCount = tab.rows.length;
            for (let i = 1; i<rowCount; i++)
            {
                tab.deleteRow(1);
            }
            creatTable();
            cont = 0;
            let coord = coords.split('=>')
            for (let i=0; i<coord.length-1; i++)
            {
                let coordinate = coord[i].split(':')
                appendCoord([parseFloat(coordinate[0]), parseFloat(coordinate[1])])
            }

            websocketClient.send(coords);
            coords = "";
        };
        clearButton.onclick = () => {
            let container = document.getElementById('container');
            container.innerHTML = '';
            vectorSource.clear(true);
            sourceV.clear(true);
            popover.hide();
            coords = "";
            const rowCount = tab.rows.length;
            for (let i = 1; i<rowCount; i++)
            {
                tab.deleteRow(1);
            }
            creatTable();
            cont = 0;
            let buttons = document.getElementById('buttons');
            const saveRouteButton = document.querySelector('[name = save_route_button]');
            const saveRouteA = document.querySelector('[name = save_route_a]');
            if (saveRouteButton != null){
                buttons.removeChild(saveRouteButton)
            }
            if (saveRouteA != null) {
                buttons.removeChild(saveRouteA)
            }
        };
    };

    websocketClient.onmessage = (message) => {//обработка сообщений от сервера
        let mes = message.data.split('|=|');
        let buttons = document.getElementById('buttons');
        if (mes[0] === 'Route'){
            const saveRouteButton = document.querySelector('[name = save_route_button]');
            const saveRouteA = document.querySelector('[name = save_route_a]');
            if (saveRouteButton != null){
                buttons.removeChild(saveRouteButton)
            }
            if (saveRouteA != null) {
                buttons.removeChild(saveRouteA)
            }

            vectorSource.clear(true);
            sourceV.clear(true);

            vectorSource.addFeatures(new ol.format.GeoJSON().readFeatures(mes[1]));

            let num = [];
            let str_h = JSON.parse(mes[2]);
            let int_h = [];
            let str_h_fly = JSON.parse(mes[4]);
            let int_h_fly = [];

            for (let i = 0; i < Number(mes[3]); i++)
            {
                int_h.push({x: i+1, y: Number(str_h[i])});
                int_h_fly.push({x: i+1, y: Number(str_h_fly[i])});
                num.push(i+1);
            }

            let cont = document.getElementById('container');
            cont.innerHTML = '';
            let canvas = document.createElement("canvas");
            canvas.id = 'myChart';
            cont.appendChild(canvas);
            let ctx = canvas.getContext('2d');

            Chart.defaults.global.elements.point.radius = 2;
            let chart = new Chart(ctx, {
                // Тип графика
                type: 'line',
                // Создание графиков
                data: {
                    // Точки графиков
                    labels: num,
                    // График
                    datasets: [{
                        label: 'Планируемая высота полета', // Название
                        backgroundColor: 'rgba(99,147,83,0.51)', // Цвет закраски
                        borderColor: 'rgb(29,50,187)', // Цвет линии
                        data: int_h_fly, // Данные каждой точки графика
                        tension: 0
                    },
                        {
                            label: 'Рельеф', // Название
                            backgroundColor: 'rgba(200,147,83,0.51)', // Цвет закраски
                            borderColor: 'rgb(215,29,29)', // Цвет линии
                            data: int_h // Данные каждой точки графика
                        }
                    ]
                }
            });

            // добавление кнопки экспортировать маршрут
            let button_exp = document.createElement('button');
            button_exp.innerText = 'Сохранить маршрут'
            button_exp.textContent = 'Сохранить маршрут';
            button_exp.setAttribute('type', 'button');
            button_exp.setAttribute('name', 'save_route_button');
            button_exp.onclick = () => {
                websocketClient.send('create|:|kml');
            }
            buttons.appendChild(button_exp)
        } else if (mes[0] === 'kml'){
            const file = new Blob([mes[1]], { type: 'application/vnd.google-earth.kml+xml'})

            let buttons = document.getElementById('buttons');
            const saveRouteButton = document.querySelector('[name = save_route_button]');

            const link = document.createElement('a')
            link.setAttribute('name', 'save_route_a');
            // привязываем атрибут "href" тега "a" к созданному файлу
            link.setAttribute('href', URL.createObjectURL(file))
            // атрибут "download" позволяет скачивать файлы, на которые указывает ссылка
            // значение этого атрибута - название скачиваемого файла
            link.setAttribute('download', 'route.kml')
            // текстовое содержимое ссылки
            link.textContent = 'Скачать файл с маршрутом'
            if (saveRouteButton != null){
                buttons.removeChild(saveRouteButton)
            }
            buttons.appendChild(link)
            // удаляем ссылку на файл
            URL.revokeObjectURL(file)
        }

    };

},false);
