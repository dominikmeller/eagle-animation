import { useEffect } from 'react';
import { withTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ActionsBar from '../components/ActionsBar';
import Header from '../components/Header';
import ProjectCard from '../components/ProjectCard';
import ProjectsGrid from '../components/ProjectsGrid';
import useAppVersion from '../hooks/useAppVersion';
import useCamera from '../hooks/useCamera';
import useProjects from '../hooks/useProjects';

const HomeView = ({ t }) => {
  const { version, latestVersion, actions: versionActions } = useAppVersion();
  const { projects, actions: projectsActions } = useProjects();
  const navigate = useNavigate();
  const { actions: cameraActions } = useCamera();

  useEffect(() => {
    cameraActions.setCamera(null);
  }, []);

  useEffect(() => {
    // Trigger background sync
    window.EA('SYNC');
  }, []);

  const handleCreateProject = async (_, title) => {
    const project = await projectsActions.create(title || t('Untitled'));
    navigate(`/animator/${project.id}/0`);
  };

  const handleOpenProject = async (id) => {
    navigate(`/animator/${id}/0`);
  };

  const handleRenameProject = async (id, title) => {
    projectsActions.rename(id, title || t('Untitled'));
  };

  const handleLink = () => {
    versionActions.openUpdatePage();
  };

  const handleAction = (action) => {
    if (action === 'SETTINGS') {
      navigate('/settings?back=/');
    }
    if (action === 'SHORTCUTS') {
      navigate('/shortcuts?back=/');
    }
  };

  return (
    <>
      <Header action={handleLink} version={version} latestVersion={latestVersion} />
      <ActionsBar actions={['SETTINGS', 'SHORTCUTS']} position="RIGHT" onAction={handleAction} />
      <ProjectsGrid>
        <ProjectCard placeholder={t('New project')} onClick={handleCreateProject} icon="ADD" />
        {[...projects]
          .sort((a, b) => b.project.updated - a.project.updated)
          .map((e) => (
            <ProjectCard key={e.id} id={e.id} title={e.project.title} picture={e.preview} onClick={handleOpenProject} onTitleChange={handleRenameProject} />
          ))}
      </ProjectsGrid>
    </>
  );
};

export default withTranslation()(HomeView);
