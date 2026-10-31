
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        DOCKERHUB_REPO = 'sarthakiparad2230/three-tier-app'
        EKS_CLUSTER_NAME = 'CD-Cluster'
        AWS_DEFAULT_REGION = 'us-east-1'
        K8S_DEPLOYMENT = 'three-tier-app-deployment'
        K8S_CONTAINER = 'three-tier-app'
        K8S_SECRET = 'three-tier-app-db-secrets'
    }

    stages {
        stage('Git Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Sarthaki15/Multi-Cloud_Deployment.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -eu
                    npm ci
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    set -eu
                    docker build \
                      -t "$DOCKERHUB_REPO:$BUILD_NUMBER" \
                      -t "$DOCKERHUB_REPO:latest" .
                '''
            }
        }

        stage('Test Docker Image') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'APP_ENV_FILE',
                        variable: 'APP_ENV_FILE'
                    )
                ]) {
                    sh '''
                        set +x
                        set -eu

                        docker rm -f test-app >/dev/null 2>&1 || true

                        docker run -d \
                          --name test-app \
                          --env-file "$APP_ENV_FILE" \
                          -p 127.0.0.1:8080:3000 \
                          "$DOCKERHUB_REPO:$BUILD_NUMBER"

                        i=1

                        while [ "$i" -le 30 ]; do
                            if curl -fsS http://127.0.0.1:8080/health; then
                                echo "Application health check passed."
                                exit 0
                            fi

                            echo "Waiting for startup... attempt $i/30"
                            sleep 2
                            i=$((i + 1))
                        done

                        docker ps -a --filter name=test-app
                        docker logs test-app
                        exit 1
                    '''
                }
            }

            post {
                always {
                    sh 'docker rm -f test-app >/dev/null 2>&1 || true'
                }
            }
        }

        stage('Docker Hub Login and Push') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-login',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {
                    sh '''
                        set +x
                        set -eu

                        printf '%s' "$DOCKER_PASSWORD" |
                          docker login \
                            --username "$DOCKER_USERNAME" \
                            --password-stdin

                        docker push "$DOCKERHUB_REPO:$BUILD_NUMBER"
                        docker push "$DOCKERHUB_REPO:latest"

                        docker logout || true
                    '''
                }
            }
        }

        stage('Configure AWS and EKS') {
            steps {
                sh '''
                    set -eu

                    aws sts get-caller-identity

                    aws eks update-kubeconfig \
                      --name "$EKS_CLUSTER_NAME" \
                      --region "$AWS_DEFAULT_REGION"

                    kubectl get nodes
                '''
            }
        }

        stage('Update Kubernetes Secret') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'secrets-db-env',
                        variable: 'DB_ENV_FILE'
                    )
                ]) {
                    sh '''
                        set +x
                        set -eu

                        kubectl create secret generic "$K8S_SECRET" \
                          --from-env-file="$DB_ENV_FILE" \
                          --dry-run=client \
                          -o yaml |
                          kubectl apply -f -
                    '''
                }
            }
        }

        stage('Deploy to EKS') {
            steps {
                sh '''
                    set -eu

                    kubectl apply -f kubernetes/deployment.yaml
                    kubectl apply -f kubernetes/service.yaml

                    kubectl set image \
                      deployment/"$K8S_DEPLOYMENT" \
                      "$K8S_CONTAINER=$DOCKERHUB_REPO:$BUILD_NUMBER"

                    kubectl rollout status \
                      deployment/"$K8S_DEPLOYMENT" \
                      --timeout=180s
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -eu

                    kubectl get deployment "$K8S_DEPLOYMENT"
                    kubectl get pods -o wide
                    kubectl get services

                    kubectl rollout status \
                      deployment/"$K8S_DEPLOYMENT" \
                      --timeout=180s

                    echo "CI/CD deployment verified successfully."
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD Pipeline completed successfully!'
        }

        failure {
            echo 'CI/CD Pipeline failed. Check the failed stage logs.'
        }

        always {
            sh 'docker rm -f test-app >/dev/null 2>&1 || true'
        }
    }
}
