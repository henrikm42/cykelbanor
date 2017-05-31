var L = require('leaflet'),
    reqwest = require('reqwest'),
    lrm = require('leaflet-routing-machine'),
    lcg = require('leaflet-control-geocoder'),
    eio = require('leaflet-editinosm'),
    RoutingControl = require('./routing-control'),
    userInfo = require('./user-info'),
    State = require('./state'),
    state = new State(window),
    initialWaypoints = state.getWaypoints(),
    Sortable = require('sortablejs'),
    geolocate = require('./geolocate'),
    locationPopup = require('./location-popup'),
    map = L.map('map', {
        closePopupOnClick: false
    }),
    GeolocateControl = require('./geolocate-control'),
    baselayers = require('./baselayers'),
    overlays = require('./overlays'),
    layerControl = new L.Control.Layers(baselayers, overlays, { position: 'bottomleft' })
        .addTo(map),
    routingControl = new RoutingControl(map, initialWaypoints).addTo(map),
    sortable = Sortable.create(document.querySelector('.leaflet-routing-geocoders'), {
        handle: '.geocoder-handle',
        draggable: '.leaflet-routing-geocoder',
        onUpdate: function(e) {
            var oldI = e.oldIndex,
                newI = e.newIndex,
                wps = routingControl.getWaypoints(),
                wp = wps[oldI];

            if (oldI === newI || newI === undefined) {
                return;
            }

            wps.splice(oldI, 1);
            wps.splice(newI, 0, wp);
            routingControl.setWaypoints(wps);
        }
    }),
    poiLayer = require('./poi-layer')(map),
    currentPopup;

L.Icon.Default.imagePath = 'assets/vendor/images';

map.attributionControl.setPrefix('<a href="/om/">Om cykelbanor.se</a>');
new L.Control.EditInOSM({
    position: 'bottomright',
    widget: 'attributionbox'
}).addTo(map);

baselayers[state.getBaseLayer() || 'Karta'].addTo(map);
state.getOverlays().forEach(function(name) {
    overlays[name].addTo(map);
});

new GeolocateControl({ position: 'topleft' }).addTo(map);

var openAddressPopup = function(e) {
    locationPopup(routingControl, poiLayer, e.latlng).openOn(map);
};

map
    .on('baselayerchange', function(e) {
        state.setBaseLayer(e.name);
    })
    .on('overlayadd', function(e) {
        state.addOverlay(e.name);
    })
    .on('overlayremove', function(e) {
        state.removeOverlay(e.name);
    })
    .on('click', function(e) {
        if (!currentPopup) {
            openAddressPopup(e);
        } else {
            map.closePopup(currentPopup);
        }
    })
    .on('popupopen', function(e) {
        currentPopup = e.popup;
    })
    .on('popupclose', function() {
        currentPopup = null;
    });

geolocate(map, function(err, p) {
        if (err) {
            var z;
            try {
                z = map.getZoom();
            } catch (e) {
                // Ok, map not initialized
            }

            if (!z) {
                map.fitBounds(L.latLngBounds([56,9.6],[68,26.6]));
                return;
            }
        }

        if (!initialWaypoints || initialWaypoints.length < 2) {
            map.setView(p.latlng, Math.min(p.zoom, 14));
        }

        L.circleMarker(p.latlng, {
            radius: 4,
            fillOpacity: 0.8
        })
        .addTo(map);
    }, {
        timeout: 5000
    });

reqwest({
    url: 'https://route.cykelbanor.se/meta/timestamp',
}).then(L.bind(function(resp) {
    var d = new Date(resp.responseText),
        s = d.toLocaleDateString('sv-SE');
    map.attributionControl.setPrefix('<a href="/om/">Om cykelbanor.se</a> | <span title="Cykelbanor uppdaterade ' + s + '">' + s + '</span>');
}, this));


routingControl
    .on('waypointschanged', function() {
        state.setWaypoints(routingControl.getWaypoints());
    });

userInfo();
