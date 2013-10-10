
/**
 * global variables
 */
var map, boundaryLayer, hoverControl, lookup, selectedRegion;
var zoomLevels = {
	"MTW" : 4, "DIW" : 4, "UTW" : 4, "UTE" : 4, "LBW" : 4, 
	"MTD" : 1, "UTA" : 1, "CTY" : 1, "GLA" : 1, 
	"EUR" : 0 
};

/**
 * load config
 *
var config;
$.ajax({
        'async': false,
        'global': false,
        'url': "/see-uk/config2.json",
        'dataType': "json",
        'success': function (data) {
            config = data;
        }
});*/


/**
 * Resize components if window is resized
 */
$(window).resize(function() {

	//  if very small screen, force a min width 1000px
	if ($(window).width() < 1000) {
		$("#map").css("width", "1000px");
		$("#container").css("width", "1000px");
        	$("#map").height($(document).height());
	} else {
		$("#container").width($(window).width() - $("#container").offset().left);
        	$("#map").height($(window).height());
	}

	//  make single column layout if screen not wide enough
	if ( $("#detail").offset().left < 575) {
		$("#selector").css({ "float": "right", "width": "720px", "margin": "20px 20px 0 0" });
	} else {
		$("#selector").css({ "float": "left",  "width": "500px", "margin": "20px 0 0 0" });
	}
});



/**
 * Move map (and scale if appropriate) such that the requested area is
 * a) visible and b) selected
 */
function selectArea(id) {

	//  if still loading, then wait a bit and try again
	if (typeof boundaryLayer.features[0] == 'undefined' || boundaryLayer.features.length == 0) {
		setTimeout("selectArea("+id+")", 500);
		return;
	}

	//  refresh, see if region is loaded
	// boundaryLayer.redraw();
	featureIndex = isFeatureLoaded(id);

	//  unselect any unwanted selected features
	for (i = 0; i < boundaryLayer.selectedFeatures.length; i++)
		if (i != featureIndex && typeof boundaryLayer.selectedFeatures[i] != 'undefined')
			hoverControl.unselect(boundaryLayer.selectedFeatures[i]);

	//  select region if it is already visibile in the map
	if (featureIndex > 0) {
		highlightSelectedRegion();
	} else {

		//  the requested feature is not currently displayed in the map.
		//  then find the centroid of the feature and move to that location/zoom level
		$.getJSON("/see-uk/unit_id/"+id+".json", function(json) {
			if (json.result.items.length == 0) {
				alert("There is no boundary for region " + id + " in the map");
				return;
			} 
			region = json.result.items[0];

			//  deal with zoom
			currentAreaCodes = boundaryLayer.areaCodeLookup[map.resolution];
			currentZoomOK = false;
			for (i = 0; i < currentAreaCodes.length; i++) {
				if (region.hasAreaCode == currentAreaCodes[i]) currentZoomOK = true;
			}
			if (!currentZoomOK) map.zoomTo(zoomLevels[region.hasAreaCode]);

			// offset the easting to account for panel on right hand side of screen
			map.panTo(new OpenSpace.MapPoint(region.easting + getMapOffset(), region.northing + (getMapOffset()/2)));
			setTimeout("highlightSelectedRegion()", 500);
		});
	}
}



/**
 * ensure that the specified region is highlighted on the map
 */
function highlightSelectedRegion() {
	if (selectedRegion == 0) return;
	id = isFeatureLoaded(selectedRegion);
	if (id >= 0) {
		hoverControl.select(boundaryLayer.features[id]);
	}
}



/**
 *  return feature index in the current boundary layer for the region with the
 *  requested admin id, or -1 if not found
 */
function isFeatureLoaded(areaID) {
	for (i = 0; i < boundaryLayer.features.length; i++) 
		if (boundaryLayer.features[i].attributes.ADMIN_UNIT_ID == areaID) return i;

	//  not found
	return -1;
}



/**
 * onLoad
 */
$(document).ready(function() {

	//  if the URL is not /see-uk/#/something then redirect
	base = 'http://apps.seme4.com/see-uk/';
	if (document.URL != base && document.URL.substr(0, base.length + 1) != base + '#') 
		window.location = base + '#/' + document.URL.substr(base.length);

	//  hide the "you need javascript" message
	$("div#js").css("display", "none");

        $(window).resize();
	selectedRegion = 0;

	//  initialise map stuff
	map = new OpenSpace.Map("map", { "resolutions": [ 1000, 500, 200, 50, 25, 10, 5, 4, 2.5, 2, 1 ] });

	//  set up the boundary layer which draws outlines
	var symbolizer = OpenLayers.Util.applyDefaults( { }, OpenLayers.Feature.Vector.style["default"]);
	styleMap = new OpenLayers.StyleMap( { 
		"default": { fillColor: "white",  fillOpacity: 0.3, strokeColor: "black",  strokeWidth: 2, strokeOpacity: 1 },
		"select" : { fillColor: "yellow", fillOpacity: 0.6, strokeColor: "black",  strokeWidth: 2, strokeOpacity: 1 }
	});
	boundaryLayer = new OpenSpace.Layer.Boundary("Boundaries", {
	    strategies: [new OpenSpace.Strategy.BBOX()],
	    area_code: ["MTW","DIW","UTW","LBW","UTE","MTD","UTA","CTY","GLA","EUR"],
	    styleMap: styleMap
	});
	boundaryLayer.areaCodeLookup = {
		"1"    : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 10 */
		"2"    : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 9 */
		"2.5"  : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 8 */
		"4"    : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 7 */
		"5"    : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 6 */
		"10"   : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 5 */
		"25"   : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 4 */
		"50"   : ["MTW","DIW","UTW","UTE","LBW"],	/* zoom 3 */
		"200"  : ["MTD","UTA", "CTY", "GLA"], 		/* zoom 2 */
		"500"  : ["MTD","UTA", "CTY", "GLA"],		/* zoom 1 */
		"1000" : ["EUR"]				/* zoom 0 */
	};
	boundaryLayer.events.register("featuresadded", boundaryLayer, highlightSelectedRegion);
	boundaryLayer.events.register("moveend", boundaryLayer, highlightSelectedRegion);
	boundaryLayer.events.register("refresh", boundaryLayer, highlightSelectedRegion);

	//  hover control allows selection of areas in the map
	hoverControl = new OpenLayers.Control.SelectFeature( boundaryLayer, {
	 	hover: false, 
		onSelect: function(feature) {
			 loadDetails(feature.attributes.ADMIN_UNIT_ID + ""); 
		} 
	});

	//  this little gem allows you to still drag/pan the map
	hoverControl.handlers.feature.stopDown = false;

	//  add all controls together
        map.addControl(hoverControl);
	hoverControl.activate();
       	map.addLayer(boundaryLayer);
	map.setCenter(new OpenSpace.MapPoint(600000, 200000), 0);

	//  phew! thats the map done.

	//  when the form is submitted, call the submitForm function
	$('#viewForm').submit(submitForm);

	//  intialise ajax history thing
	$.address.change(updateFromHistoryNavEvent);

	//  make sliding headers work
	$("div.header").click(function() {
		$(this).next().slideToggle();
	});

});



/**
 * Callback from user clicking on map selecting a region
 */
function loadDetails(id) {
	if (selectedRegion != id) {
		selectedRegion = id;
		selectArea(id);
		$("#postcode").val("");
		$("#areaID").val(id);
		if (map.zoom == 4 || map.zoom == 3) $("#zoom-ward").attr("checked", "on");
		if (map.zoom == 2 || map.zoom == 1) $("#zoom-county").attr("checked", "on");
		if (map.zoom == 0) $("#zoom-region").attr("checked", "on");
		submitForm();
	}

}



/** 
 * Return 20% of screen width in OS coords
 * used to offset the centre of map to
 * account for panel on right hand side.
 */
function getMapOffset() {
	e = map.getExtent();
	return (e.right - e.left) * 0.2;
}



/**
 * post main form to get the google viz
 * and put results into the correct div
 */
function submitForm() {

	//  formulate the coolURI
	coolURI = $('#type').val() + '/' + 
		  $('input[name=norm]:checked').val() + '/' +
		  $('input[name=zoom]:checked').val() + '/';
	if ($('#postcode').val().length > 0) coolURI += $('#postcode').val();
	else coolURI += $('#areaID').val();

	//  by recording a change to the current navigation state,
	//  then the callback is fired, which loads the display.
	$.address.value(coolURI);
	setFormTitle();

	return false; 
}



/**
 * ajax load the google vis
 */
function ajaxLoad() {

	$("#viz").children().fadeTo("slow", 0);
	$("#viz").css("background", "url('/see-uk/assets/imgs/loading.gif') no-repeat 50% 50% #ddd");
	$("#vizTitle").html("Loading...");

	//  request visualisation for this area	
	$.ajax({
		data: $('#viewForm').serialize(),
		type: 'GET',
		url: "/see-uk/detail.php",
		success: function(response) { 
				$('#viz').css("backgroundImage", "none").html(response); 
				updateImageMap();
			}
	});
}



/**
 *  Callback event from a change in the URL or browser moving fwd/back in
 *  history. takes the #/crime/by-population/etc/, sets the correct values in
 *  the form, and requests the viz
 */
function updateFromHistoryNavEvent(event) {

	bits = event.value.split('/');

	//  update the form values
	if (typeof bits[1] != 'undefined' && bits[1].length > 0) $('#type').val(bits[1]);
	if (typeof bits[2] != 'undefined' && bits[2].length > 0) $('#norm-' + bits[2]).attr('checked', true);
	if (typeof bits[3] != 'undefined' && bits[3].length > 0) $('#zoom-' + bits[3]).attr('checked', true);

	if (typeof bits[4] != 'undefined' && !isNaN(bits[4])) {
		$('#postcode').val("");
		$('#areaID').val(bits[4]);
	} else if (typeof bits[4] != 'undefined') {
		$('#postcode').val(unescape(bits[4]));
		$('#areaID').val("");
	}

	setFormTitle();
	ajaxLoad();
}



/**
 * Set title of main vizualisation pane
 */
function setTitle(t) {
	$("#vizTitle").html(t);
	document.title = "See UK :: " + t.replace('&amp;', '&');
}

/**
 * set the title for the form, based on selected values
 */
function setFormTitle() {

	norm = $('input[name=norm]:checked + label').text();
	caption  = "See UK :: " + $('#type option:selected').text();
	if (norm == 'actual values') caption += ' (actual values) at ';
	else caption += ' (normalised ' +  norm + ") at ";
	caption += $('input[name=zoom]:checked + label').text() + " level";
	$("#showing").html(caption);
}


/**
 * Set postcode field
 */
function setPostcode(t) {
	$("#postcode").val(t);
}




/**
 * Modify the HREF in image map such that the links point to #/crime/whatever
 * to do ajax in-page loading rather than reload entire page
 */
function updateImageMap() {
	$('area').attr('href', 
		function (i, val) { 
			if (typeof val == 'undefined' || val.length == 0) return '';
			return '#' + val.substr(7); 
		}); 
}


/**
 * show pop-up search box
 */
function showSearch() {
	$.facebox({ div: '#search' });
	$("#facebox #search_box").keypress(function(event) {
	  if (event.which == '13') {
	     event.preventDefault();
	     doSearch();
	   }
	});
	$("#facebox #search_box").focus();
	return false;
}

/** 
 * action search
 */
function doSearch() {
	if ($('#facebox #search_box').val().length > 0) {
		$(document).trigger('close.facebox');
		$('#postcode').val($('#facebox #search_box').val());
		submitForm();
	}
	return false;
}


/** 
 * show the trend box
 */
function showTrend() {
	$.facebox({ "div": "#trend" }, "trend");
	$("#facebox div.trend").css({ "background": "url('/see-uk/assets/imgs/loading.gif') no-repeat 50% 50% #eee" });

	 
	$.ajax({
		data: $('#viewForm').serialize(),
		type: 'GET',
		url: "/see-uk/trend-snippet.php",
		success: function(response) { 
			$('div#facebox div.trend').css("backgroundImage", "none").html(response); 
		}
	});
}
