var editor_version = '0.2.0';
var DWC_MIDI_NAME = 'UBIStage Drawbars Commander';
var DWC_MIDI_MANUF_ID_1			=	0x37;
var DWC_MIDI_MANUF_ID_2			=	0x72;
var DWC_MIDI_PRODUCT_ID			=	0x09;

var DWC_MANUF = [DWC_MIDI_MANUF_ID_1, DWC_MIDI_MANUF_ID_2, DWC_MIDI_PRODUCT_ID];

/* ************************************************************************
 *  SysEX implementation
 *
 *  Format for the requests :
 *  F0 X_MANID1 X_MANID2 X_PRODID X_REQ OBJECT vv F7
 * Format for the reply
 * F0 X_MANID1 X_MANID2 X_PRODID X_REP OBJECT (Reply COdes) vv F7
 */

var X_REQ = 0x00; // Request
var X_REP = 0x01; // Replay

var X_FW_VER 			= 0x01; // Firmware version. Replay vv is VERSION_MAJOR VERSION_MINOR VERSION_PATCH.
var X_ACTIVE_PRESET 	= 0x02; // The active preset. Replay vv is byte) Active preset id [0-3].

var X_REQ_CTRL_PARAMS 	= 0x10; // Current settings for a control: PRESET_ID CTRL_ID. Reply vv is: PRESET_ID CTRL_ID UPP_Type UPP_Prm UPP_Min UPP_Max UPP_Ch UPP_Behaviour LOW_Type LOW_Prm LOW_Min LOW_Max LOW_Ch LOW_Behaviour ALT_Type ALT_Prm ALT_Min ALT_Max ALT_Ch ALT_Behaviour
var X_SET_CTRL_PARAMS 	= 0x11; // Send the settings for a control (but doesn't save it): PRESET_ID CTRL_ID UPP_Type UPP_Prm UPP_Min UPP_Max UPP_Ch UPP_Behaviour LOW_Type LOW_Prm LOW_Min LOW_Max LOW_Ch LOW_Behaviour ALT_Type ALT_Prm ALT_Min ALT_Max ALT_Ch ALT_Behaviour. Reply vv is 0 if is all right, an Error code if something went wrog
var X_SET_PARAM 		= 0x12; // Send a setting for a single parameter (but doesn't save it): PRESET_ID CTRL_ID PARAM_ID (0-18) param value;
var X_CMD_SAVE_PRESET	= 0x7F; // Save the Preset to the non volative memory: vv is PRESET_ID. Reply vv is 0 if all went ok, an error code if someting wen wrong

var X_OK = 0x00;
var X_ERROR = 0x7F; // Something went wrong

/*
 * ERROR CODES
 */
  var X_ERROR_UNKNOWN = 0x7F;
  var X_ERROR_PRESET  = 0x10;
  var X_ERROR_CONTROL = 0x20;
  var X_ERROR_PARAM   = 0x30;

var error = null;
var midi_connected = false // store the connection status to avoid two "I'm connected"
var midi_disconnected = false // store the connection status to avoid two "I'm disconnected"

var NUM_PRESETS = 4;
var NUM_CTRL = 18;
var ACTIVE_PRESET = '';

var IS_GLOBAL = 1;
var SEND_BOTH = 2;
var IS_TOGGLE = 4;

$(function(){
	$('#editor_version_label').text( editor_version );
	disable_inputs();
	// https://github.com/djipco/webmidi
	WebMidi.enable(function (err) {

	  if (err) {
		alert("WebMidi could not be enabled.", err)
	  }
	  else{
		  // logmessage("MIDI Outputs: ", WebMidi.outputs);
		  to_dwc = WebMidi.getOutputByName( DWC_MIDI_NAME )

		  if( !to_dwc) {
			alert( "Can't find any DWC to talk to", err )
		  }

  		  // logmessage("MIDI Inputs: ",WebMidi.inputs);
  		  from_dwc = WebMidi.getInputByName( DWC_MIDI_NAME )

		  if( !from_dwc) {
			  alert( "Can't find any DWC to listen", err )
		  }
		  else{
			  	// Listen for a 'note on' message on all channels
				from_dwc.addListener('sysex', "all", function (e) { parse_sysex( e ) });
		  }

		  if( to_dwc && from_dwc ){

			  WebMidi.addListener("connected", e => {
				if ( !midi_connected){
					midi_connected = true;
					midi_disconnected = false;
					alert("Device connected: " + e.port.name, e);
					enable_inputs();
					$('#connection_status').removeClass('badge-danger');
					$('#connection_status').addClass('badge-success');
					$('#connection_status').text('Connected');
					req_fw_version();
					// param_init();
				}
			  });

			  WebMidi.addListener("disconnected", e => {
				  if ( !midi_disconnected){
					  	midi_disconnected = true
						alert("Device disconnected: " + e.port.name)
						disable_inputs();
						$('#connection_status').addClass('badge-danger');
						$('#connection_status').removeClass('badge-success');
						$('#connection_status').text('Disconnected');
						midi_connected = false;
					}
			  });
		  }
		  else{
			  //not connected
		  }

	  }
  	}, true // Enable SysEx support
	);
});

function disable_inputs(){
	$('#input_parameters input,select').prop('disabled', true);
	$('#preset_reload_btn').prop('disabled', true);
}

function enable_inputs(){
	$('#input_parameters input,select').prop('disabled', false);
	$('#preset_reload_btn').prop('disabled', false);
}

function req_fw_version( ){
	console.log('Reqesting firmware version');
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_FW_VER] )
}

function req_active_preset( ){
	console.log('Reqesting active prst');
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_ACTIVE_PRESET] )
}

function req_controls( preset_id, ctrl_id ){
	console.log('Reqesting control: ', ctrl_id);
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_REQ_CTRL_PARAMS, preset_id, ctrl_id ] )
}
function set_controls( preset_id, ctrl_id ){
	console.log('Set control: ', ctrl_id);
	//to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_SET_CTRL_PARAMS, preset_id, ctrl_id ] )
}
function set_param( preset_id, ctrl_id, param_id, value ){
	console.log('Set parameter: ', param_id);
	console.log('value:', value);
	console.log('ctrl_id: ',ctrl_id);
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_SET_PARAM, preset_id, ctrl_id, param_id, value ] )
}
function raise_error(error){
	console.log('error', error);
}
function save_preset( preset_id ){
	console.log('send save preset', preset_id);
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_CMD_SAVE_PRESET, preset_id] )

}
function parse_sysex( e ){
	console.log();('Received SysEx:', e.data );

	if ( e.data[1] != DWC_MIDI_MANUF_ID_1 || e.data[2] != DWC_MIDI_MANUF_ID_2 || e.data[3] != DWC_MIDI_PRODUCT_ID ) return null; // Discard all SysEx that's not for this device
	if ( e.data[4] != X_REP ) return null; // Discard all messages that are not a reply

	var message_type = e.data[5];
	var reply = e.data[6];
	if( reply == X_ERROR ){
		error = e.data[7];
	}
	else{
		error = null;
	}
	console.log( 'message_type', message_type );
	console.log( 'sysex data:', e.data);

	var data = Object.values(e.data);
	data = data.slice( 7, -1 );

	switch ( message_type ) {
		case X_FW_VER:
		console.log('receive version');
			if( error )return raise_error(error);
			if( data.length != 3 )return raise_error('invalid version data');
			var version = data.join('.');
			console.log('version:', version);
			$('#fw_version_label').text( version );
			req_active_preset();
		break;
		case X_ACTIVE_PRESET:
			if( error )return raise_error(error);
			if( data.length != 1 || data[0] > NUM_PRESETS-1 )return raise_error('invalid preset id');
			ACTIVE_PRESET = data[0];
			console.log('active preset: ', ACTIVE_PRESET);
			$('#active_preset').text( ACTIVE_PRESET );
			req_controls( ACTIVE_PRESET, 0 );
		break;
		case X_REQ_CTRL_PARAMS:
			if( error )return raise_error(error);
			var preset_id = data[0];
			if( preset_id != ACTIVE_PRESET ) return raise_error('not current preset'); //Discard the message because it's for a preset we are not editing
			var ctrl_id = data[1];
			var ctrls = data.slice( 2 );

			for (var param in ctrls){
				//console.log('parametro: ', ctrls[param]);
				if( param == 5 || param == 11 || param == 17 ){ // this are the checkboxes

					if( ctrls[param] & IS_GLOBAL){
						$('#' + ctrl_id + '_' + param + '_global').attr('checked', 'checked');
					}
					if( ctrls[param] & SEND_BOTH){
						$('#' + ctrl_id + '_' + param + '_both').attr('checked', 'checked');
					}
					if( ctrls[param] & IS_TOGGLE){
						$('#' + ctrl_id + '_' + param + '_toggle').attr('checked', 'checked');
					}

				}
				else{
					$('#' + ctrl_id + '_' + param).val(ctrls[param]);
				}
			}
			ctrl_id = ctrl_id + 1;
			if( ctrl_id < NUM_CTRL ){ //request for all the controls in the preset
				req_controls( ACTIVE_PRESET, ctrl_id );
			}
			$('.is_changed').removeClass('is_changed');
			$('#preset_save_btn').prop('disabled', true)
		break;
		case X_SET_CTRL_PARAMS:
			if( error )return raise_error(error);
			var preset_id = data[0];
			if( preset_id != ACTIVE_PRESET ) return raise_error('not current preset'); //Discard the message because it's for a preset we are not editing
			var ctrl_id = data[1];
			ctrl_id = ctrl_id + 1;
			if( ctrl_id < NUM_CTRL ){ //request for all the controls in the preset
				set_controls( ACTIVE_PRESET, ctrl_id );
			}
		break;
		case X_SET_PARAM:
			console.log('reply to X_SET_PARAM');
			if( error )return raise_error(error);
			if( data.length != 4 )return raise_error('invalid parameter data');
			var preset_id = data[0];
			if( preset_id != ACTIVE_PRESET ) return raise_error('not current preset'); //Discard the message because it's for a preset we are not editing
			var ctrl_id = data[1];
			var param_id = data[2];
			var param_value = data[3];
			console.log('value:', param_value);
			if( param_id == 5 || param_id == 11 || param_id == 17 ){ // this are the checkboxes
				if( param_value & IS_GLOBAL){
					$('#' + ctrl_id + '_' + param_id + '_global').attr('checked', 'checked');
				}
				if( param_value & SEND_BOTH){
					$('#' + ctrl_id + '_' + param_id + '_both').attr('checked', 'checked');
				}
				if( param_value & IS_TOGGLE){
					$('#' + ctrl_id + '_' + param_id + '_toggle').attr('checked', 'checked');
				}
			}
			else{
				$('#' + ctrl_id + '_' + param_id).val(param_value);
			}
			$('#' + ctrl_id + '_' + param_id).addClass('is_changed');
		break;
		case X_CMD_SAVE_PRESET:
			console.log('reply to X_CMD_SAVE_PRESET');
			if( error )return raise_error(error);
			if( data.length != 1 || data[0] > NUM_PRESETS-1 )return raise_error('invalid preset id');
			alert('Preset ' + data[0] + ' saved.');
			console.log('preset saved: ', data[0]);
			$('#preset_save_btn').prop('disabled', true)
			$('.is_changed').removeClass('is_changed');
		break;
		default:
			console.log( 'unknown sysex data:', data);
		break;
	}
}

$('#input_parameters input,select').change(function(c) {
	console.log('changed');
	$('#preset_save_btn').prop('disabled', false)

	var id = this.id;
	var ind = id.split("_");
	var ctrl_id = ind[0];
	var param_id = ind[1];
	var value = $( '#' + this.id).val();
	set_param( ACTIVE_PRESET, ctrl_id, param_id, value);
});

$('#preset_save_btn').click(function(e) {
	console.log('click save');
	save_preset( ACTIVE_PRESET );
});

$('#preset_reload_btn').click(function(e) {
	console.log('click reload');
	req_fw_version();
});
