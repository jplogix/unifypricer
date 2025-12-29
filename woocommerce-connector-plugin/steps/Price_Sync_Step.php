<?php

interface Price_Sync_Step
{
	public function getName();

	public function runStep($token);
}
