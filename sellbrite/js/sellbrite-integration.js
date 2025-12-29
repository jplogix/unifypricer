jQuery( document ).on( 'submit', '#integration-description form', function ( e ) {
	e.preventDefault();
	jQuery( '#integration-description' ).hide();
	jQuery( '#integration-progress' ).show();

	launchStep( 0 );
});

var currentStep;

function finishIntegration( result, isError, data ) {
	var $result = jQuery( '#integration-result' );

	if ( isError ) {
		$result.html( result) ;
		$result.addClass( 'is-error' );
		return;
	}

	$result.removeClass( 'is-error' );
	$result.html( result + '<ul><li><b>Store URL:</b> ' + sellbriteStoreUrl + '</li><li><b>API Key:</b> ' + data[ 'consumer_key' ] + '</li><li><b>API Secret:</b> ' + data[ 'consumer_secret' ] + '</li><li><b>SB Connect URL:</b> <a href="' + data[ 'url' ] + '" target="_blank">' + data[ 'url' ] + '</a></li></ul>' );

	// try to open the URL in a new tab
	var win = window.open( data[ 'url' ], '_blank' );
	if ( win ) {
		// browser has allowed it to be opened
		win.focus();
	} else {
		// browser has blocked it, open in the same tab
		window.location = data[ 'url' ];
	}
}

function stepResponseHandler( response ) {
	var data = response ? JSON.parse( response ) : null;

	if ( !data || !data.success ) {
		jQuery( '#sellbrite-step-' + currentStep ).addClass( 'step-failed' );
		finishIntegration( !data || !data.message ? defaultIntegrationError : data.message, true );
		return;
	}

	if ( currentStep + 1 === integrationStepCount ) {
		++currentStep;
		updateIntegrationProgress();
		finishIntegration( successfulIntegrationMessage, false, data.data );
		return;
	}

	launchStep( currentStep + 1 );
}

function launchStep( step ) {
	currentStep = step;
	updateIntegrationProgress();

	jQuery.ajax( {
		type: "POST",
		url: sellbriteBaseUrl,
		data: {
			action: 'sellbrite_integrate',
			step: currentStep
		}
	} ).always( stepResponseHandler );
}

function updateIntegrationProgress() {
	for ( var i = 0; i < integrationStepCount; ++i ) {
		var $step = jQuery( '#sellbrite-step-' + i );
		$step.removeClass( 'step-in-progress' );
		$step.removeClass( 'step-complete' );
		$step.removeClass( 'step-failed' );

		if (i <= currentStep) {
			$step.addClass( ( i === currentStep ) ? 'step-in-progress' : 'step-complete' );
		}
	}
}
