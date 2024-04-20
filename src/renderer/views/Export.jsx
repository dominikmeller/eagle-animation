import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { withTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import ActionCard from '../components/ActionCard';
import ActionsBar from '../components/ActionsBar';
import FormGroup from '../components/FormGroup';
import FormLayout from '../components/FormLayout';
import LoadingOverlay from '../components/LoadingOverlay';
import NumberInput from '../components/NumberInput';
import Select from '../components/Select';
import Switch from '../components/Switch';
import { ALLOWED_LETTERS } from '../config';
import { ExportFrames, GetBestResolution } from '../Exporter';
import useAppCapabilities from '../hooks/useAppCapabilities';
import useSettings from '../hooks/useSettings';

const generateCustomUuid = (length) => {
  const array = new Uint32Array(length);
  self.crypto.getRandomValues(array);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALLOWED_LETTERS[array[i] % ALLOWED_LETTERS.length];
  }
  return out;
};

const Export = ({ t }) => {
  const { id, track } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [isInfosOpened, setIsInfosOpened] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [publicCode, setPublicCode] = useState(null);
  const [frameRenderingProgress, setFrameRenderingProgress] = useState(0);
  const [videoRenderingProgress, setVideoRenderingProgress] = useState(0);
  const [bestResolution, setBestResolution] = useState(null);

  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { appCapabilities } = useAppCapabilities();

  const form = useForm({
    mode: 'all',
    defaultValues: {
      mode: 'none',
      format: 'h264',
      resolution: 'original',
      framesFormat: 'original',
      duplicateFramesCopy: true,
      duplicateFramesAuto: false,
      duplicateFramesAutoNumber: 2,
      framerate: 12,
      customOutputFramerate: false,
      customOutputFramerateNumber: 60,
    },
  });

  const { watch, setValue, register, handleSubmit, control } = form;

  useEffect(() => {
    (async () => {
      const projectData = await window.EA('GET_PROJECT', { project_id: id });
      setProject(projectData);
      setValue('framerate', projectData.project.scenes[Number(track)].framerate);
      setBestResolution(await GetBestResolution(projectData.project.scenes[Number(track)].pictures));
    })();
  }, []);

  useEffect(() => {
    window.EAEvents('FFMPEG_PROGRESS', (evt, args) => {
      setVideoRenderingProgress(args.progress || 0);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const bestMode = appCapabilities.includes('EXPORT_VIDEO') ? 'video' : appCapabilities.includes('EXPORT_FRAMES') ? 'frames' : appCapabilities.includes('BACKGROUND_SYNC') ? 'send' : 'none';
      if (
        (watch('mode') === 'video' && !appCapabilities.includes('EXPORT_VIDEO')) ||
        (watch('mode') === 'frames' && !appCapabilities.includes('EXPORT_FRAMES')) ||
        (watch('mode') === 'send' && !appCapabilities.includes('BACKGROUND_SYNC')) ||
        watch('mode') === 'none'
      ) {
        setValue('mode', bestMode);
      }
    })();
  }, [appCapabilities]);

  if (!project || !settings) {
    return null;
  }

  const progress = watch('mode') === 'frames' ? Math.min(frameRenderingProgress, 1) : Math.min(frameRenderingProgress / 2, 0.5) + Math.min(videoRenderingProgress / 2, 0.5);

  const handleBack = async () => {
    navigate(searchParams.get('back') || '/');
  };

  const handleExport = async (data) => {
    const exportRatio = 16 / 9;

    setIsInfosOpened(true);
    setIsExporting(true);
    setFrameRenderingProgress(0);
    setVideoRenderingProgress(0);

    const files = project.project.scenes[Number(track)].pictures;

    let resolution = data.resolution === 'original' ? null : { width: Number(data.resolution) * exportRatio, height: Number(data.resolution) };
    if (data.mode !== 'frames' && !resolution) {
      const maxResolution = await GetBestResolution(files, exportRatio);
      if (maxResolution) {
        resolution = { width: Number(maxResolution.height) * exportRatio, height: Number(maxResolution.height) };
      }
    }

    const newCode = data.mode === 'send' ? await generateCustomUuid(8) : null;

    if (data.mode === 'send') {
      setPublicCode(newCode);
    }

    // Ask user to define output path
    const outputPath =
      data.mode === 'send'
        ? null
        : await window.EA('EXPORT_SELECT_PATH', {
            type: data.mode === 'video' ? 'FILE' : 'FOLDER',
            format: data.format,
            translations: {
              EXPORT_FRAMES: t('Export animation frames'),
              EXPORT_VIDEO: t('Export as video'),
              DEFAULT_FILE_NAME: t('video'),
              EXT_NAME: t('Video file'),
            },
          });

    // Compute all frames
    const frames = await ExportFrames(
      files,
      {
        duplicateFramesCopy: data.duplicateFramesCopy,
        duplicateFramesAuto: data.mode === 'send' ? true : data.duplicateFramesAuto,
        duplicateFramesAutoNumber: data.mode === 'send' ? data.framerate : data.duplicateFramesAutoNumber,
        forceFileExtension: data.mode === 'frames' ? (data.framesFormat === 'original' ? undefined : data.framesFormat) : 'jpg',
        resolution,
      },
      (p) => setFrameRenderingProgress(p)
    );

    // Save frames / video on the disk
    await window.EA('EXPORT', {
      frames,
      output_path: outputPath,
      mode: data.mode,
      format: data.format,
      framerate: data.framerate,
      frames_format: data.framesFormat,
      custom_output_framerate: data.customOutputFramerate,
      custom_output_framerate_number: data.customOutputFramerateNumber,
      project_id: id,
      track_id: track,
      event_key: settings.EVENT_KEY,
      public_code: data.mode === 'send' ? newCode : undefined,
    });

    setIsExporting(false);
  };

  const handleModeChange = (v) => () => {
    setValue('mode', v);
  };

  const formats = [
    ...(appCapabilities.includes('EXPORT_VIDEO_H264') ? [{ value: 'h264', label: t('H264 (Recommended)') }] : []),
    ...(appCapabilities.includes('EXPORT_VIDEO_HEVC') ? [{ value: 'hevc', label: t('HEVC (.mp4)') }] : []),
    ...(appCapabilities.includes('EXPORT_VIDEO_PRORES') ? [{ value: 'prores', label: t('ProRes (.mov)') }] : []),
    ...(appCapabilities.includes('EXPORT_VIDEO_VP8') ? [{ value: 'vp8', label: t('VP8 (.webm)') }] : []),
    ...(appCapabilities.includes('EXPORT_VIDEO_VP9') ? [{ value: 'vp9', label: t('VP9 (.webm)') }] : []),
  ];

  const resolutions = [...new Set(['original', ...(bestResolution?.height ? [bestResolution.height] : []), 2160, 1440, 1080, 720, 480, 360, 240])]
    .filter((height) => height === 'original' || !bestResolution || height <= bestResolution?.height)
    .map((e) => ({ value: e, label: e === 'original' ? t('Original (Recommended)') : t('{{resolution}}p', { resolution: e }) }));

  const framesFormats = [
    { value: 'original', label: t('Original (Recommended)') },
    { value: 'jpg', label: t('JPEG (.jpg)') },
    { value: 'png', label: t('PNG (.png)') },
    { value: 'webp', label: t('WEBP (.webp)') },
  ];

  return (
    <>
      <ActionsBar actions={['BACK']} onAction={handleBack} />
      {settings && (
        <form id="export">
          <FormLayout title={t('Export')}>
            <div style={{ display: 'flex', gap: 'var(--space-medium)', justifyContent: 'center' }}>
              {appCapabilities.includes('EXPORT_VIDEO') && <ActionCard icon="VIDEO" title={t('Export as video')} action={handleModeChange('video')} selected={watch('mode') === 'video'} />}
              {appCapabilities.includes('EXPORT_FRAMES') && <ActionCard icon="FRAMES" title={t('Export animation frames')} action={handleModeChange('frames')} selected={watch('mode') === 'frames'} />}
              {appCapabilities.includes('BACKGROUND_SYNC') && settings.EVENT_KEY && (
                <ActionCard icon="SEND" title={t('Upload the video')} action={handleModeChange('send')} selected={watch('mode') === 'send'} />
              )}
            </div>

            {['video', 'send'].includes(watch('mode')) && (
              <FormGroup label={t('Video format')} description={t('The exported video format')}>
                <Select control={control} options={formats} register={register('format')} />
              </FormGroup>
            )}

            {watch('mode') === 'frames' && (
              <FormGroup label={t('Frames format')} description={t('The format of exported frames')}>
                <Select control={control} options={framesFormats} register={register('framesFormat')} />
              </FormGroup>
            )}

            {['video', 'frames', 'send'].includes(watch('mode')) && (
              <FormGroup
                label={watch('mode') === 'frames' ? t('Frames resolution') : t('Video resolution')}
                description={watch('mode') === 'frames' ? t('The exported frames resolution') : t('The exported video resolution')}
              >
                <Select control={control} options={resolutions} register={register('resolution')} />
              </FormGroup>
            )}

            {['video', 'send'].includes(watch('mode')) && (
              <FormGroup label={t('Animation framerate')} description={t('The framerate used for your animation')}>
                <NumberInput register={register('framerate')} min={1} max={240} />
              </FormGroup>
            )}

            {['video', 'send'].includes(watch('mode')) && (
              <FormGroup label={t('Custom video output framerate')} description={t('Change the exported video framerate (This is not your animation framerate)')}>
                <div style={{ display: 'inline-block' }}>
                  <Switch register={register('customOutputFramerate')} />
                </div>
                {watch('customOutputFramerate') && (
                  <div style={{ display: 'inline-block', marginLeft: 'var(--space-big)' }}>
                    <NumberInput register={register('customOutputFramerateNumber')} min={watch('framerate')} max={240} />
                  </div>
                )}
              </FormGroup>
            )}

            {['video', 'frames'].includes(watch('mode')) && (
              <FormGroup label={t('Duplicate first and last frames')} description={t('Automatically duplicate the first and last frames')}>
                <div style={{ display: 'inline-block' }}>
                  <Switch register={register('duplicateFramesAuto')} />
                </div>
                {watch('duplicateFramesAuto') && (
                  <div style={{ display: 'inline-block', marginLeft: 'var(--space-big)' }}>
                    <NumberInput register={register('duplicateFramesAutoNumber')} min={2} max={10} />
                  </div>
                )}
              </FormGroup>
            )}

            {watch('mode') === 'frames' && (
              <FormGroup label={t('Duplicate frames')} description={t('Copies several times the duplicated frames')}>
                <div>
                  <Switch register={register('duplicateFramesCopy')} />
                </div>
              </FormGroup>
            )}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ActionCard title={t('Export')} action={handleSubmit(handleExport)} sizeAuto secondary disabled={isInfosOpened} />
            </div>
          </FormLayout>
        </form>
      )}
      {isInfosOpened && (
        <LoadingOverlay
          publicCode={publicCode}
          isExporting={isExporting}
          progress={progress}
          onCancel={() => {
            setIsInfosOpened(false);
            setIsExporting(false);
          }}
        />
      )}
    </>
  );
};

export default withTranslation()(Export);
