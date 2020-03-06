var DWC_MIDI_NAME = 'UBIStage Drawbars Commander';
var DWC_MIDI_MANUF_ID_1			=	0x37;
var DWC_MIDI_MANUF_ID_2			=	0x72;
var DWC_MIDI_PRODUCT_ID			=	0x09;

var DWC_MANUF = [DWC_MIDI_MANUF_ID_1, DWC_MIDI_MANUF_ID_2, DWC_MIDI_PRODUCT_ID];

// F0 X_MANID1 X_MANID2 X_PRODID ACTION OBJECT vv F7

var X_REQ = 0x00; // Request
var X_REP = 0x01; // Replay

var X_FW_VER 			= 0x01; // Firmware version. Replay vv is VERSION_MAJOR VERSION_MINOR VERSION_PATCH.
var X_ACTIVE_PRESET 	= 0x02; // The active preset. Replay vv is byte) Active preset id [0-3].

var X_REQ_CTRL_PARAMS 	= 0x10; // Current settings for a control: PRESET_ID CTRL_ID. Reply vv is: PRESET_ID CTRL_ID UPP_Type UPP_Prm UPP_Min UPP_Max UPP_Ch UPP_Behaviour LOW_Type LOW_Prm LOW_Min LOW_Max LOW_Ch LOW_Behaviour ALT_Type ALT_Prm ALT_Min ALT_Max ALT_Ch ALT_Behaviour
var X_SET_CTRL_PARAMS 	= 0x11; // Send the settings for a control (but doesn't save it): PRESET_ID CTRL_ID UPP_Type UPP_Prm UPP_Min UPP_Max UPP_Ch UPP_Behaviour LOW_Type LOW_Prm LOW_Min LOW_Max LOW_Ch LOW_Behaviour ALT_Type ALT_Prm ALT_Min ALT_Max ALT_Ch ALT_Behaviour. Reply vv is 0 if is all right, an Error code if something went wrog

var X_CMD_SAVE_PRESET	= 0x7F; // Save the Preset to the non volative memory: vv is PRESET_ID. Reply vv is 0 if all went ok, an error code if someting wen wrong

var X_OK = 0x00;
var X_ERROR = 0x01; // Something went wrong

var midi_connected = false // store the connection status to avoid two "I'm connected"
var midi_disconnected = false // store the connection status to avoid two "I'm disconnected"
var NUM_PRESETS = 4;
var NUM_CTRL = 18;
var ACTIVE_PRESET = '';

$(function(){
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
					alert("Device connected: " + e.port.name, e)
					req_fw_version();
					// param_init();
				}
			  });

			  WebMidi.addListener("disconnected", e => {
				  if ( !midi_disconnected){
					  	midi_disconnected = true
					    alert("Device disconnected: " + e.port.name, e);
						alert("Device disconnected: " + e.port.name)
						midi_connected = false;
					}
			  });
		  }

	  }
  	}, true // Enable SysEx support
	);
});

function req_fw_version( ){
	alert('Reqesting firmware version');
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_FW_VER] )
}

function req_active_preset( ){
	alert('Reqesting active prst');
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_ACTIVE_PRESET] )
}

function req_controls( preset_id, ctrl_id ){
	console.log('Reqesting control: ', ctrl_id);
	to_dwc.sendSysex( DWC_MANUF, [X_REQ, X_REQ_CTRL_PARAMS, preset_id, ctrl_id ] )
}

function parse_sysex( e ){
	console.log();('Received SysEx:', e.data );

	if ( e.data[1] != DWC_MIDI_MANUF_ID_1 || e.data[2] != DWC_MIDI_MANUF_ID_2 || e.data[3] != DWC_MIDI_PRODUCT_ID ) return null; // Discard all SysEx that's not for this device
	if ( e.data[4] != X_REP ) return null; // Discard all messages that are not a reply

	var message_type = e.data[5];
	console.log();(message_type);
	var data = Object.values(e.data);
	data = data.slice( 6, -1 );
	console.log( 'data_array', data);

	switch ( message_type ) {
		case X_FW_VER:
			if( data.length != 3 ) return X_ERROR;
			var version = data.join('.');
			console.log('version:', version);
			$('#version_label').text( version );
			req_active_preset();
		break;
		case X_ACTIVE_PRESET:
			if( data.length != 1 || data[0] > NUM_PRESETS-1 ) return X_ERROR;
			ACTIVE_PRESET = data[0];
			console.log('active preset: ', ACTIVE_PRESET);
			$('#active_preset').text( ACTIVE_PRESET );
			req_controls( ACTIVE_PRESET, 0 );
		break;
		case X_REQ_CTRL_PARAMS:
			var preset_id = data[0];
			if( preset_id != ACTIVE_PRESET ) return null; //Discard the message because it's for a preset we are not editing
			var ctrl_id = data[1];
			var ctrls = data.slice( 2 );
			console.log('controls: ', ctrl );

			for (var param in ctrls){
				//console.log('parametro: ', ctrls[param]);
				if( param == 5 || param == 11 || param == 17 ){
					console.log('checkbox', ctrls[param]);
				}
				else{
					$('#' + ctrl_id + '_' + param).val(ctrls[param]);
				}

			}
			ctrl_id = ctrl_id + 1;
			if( ctrl_id <= NUM_CTRL ){ //request for all the controls in the preset
				req_controls( ACTIVE_PRESET, ctrl_id );
			}
		break;
		default:
			console.log( 'unknown sysex data:', data);
		break;
	}
}
